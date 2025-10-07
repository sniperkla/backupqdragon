// Minimal copy specialized for the standalone service
import { google } from 'googleapis'
import { Readable } from 'stream'
import path from 'path'
import SystemSetting from '../models/systemSettingModel.js'
import { connectToDatabase } from '../mongodb.js'
import User from '../models/userModel.js'
import CodeRequest from '../models/codeRequestModel.js'
import CustomerAccount from '../models/customerAccountModel.js'
import TopUp from '../models/topUpModel.js'
import PlanSetting from '../models/planSettingModel.js'
import PointTransaction from '../models/pointTransactionModel.js'
import ExtensionRequest from '../models/extensionRequestModel.js'

class GoogleDriveBackupService {
  constructor() {
    this.drive = null
    this.auth = null
    this.parentFolderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || null
    this.driveId = null
    this.authMode = 'service'
    this.configSource = { oauth: 'none', folder: process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID ? 'env' : 'none' }
  }

  async initialize() {
    try {
      await connectToDatabase().catch(()=>{})
      const [dbClientId, dbClientSecret, dbRefreshToken, dbFolderId] = await Promise.all([
        SystemSetting.getSetting('backup_google_oauth_client_id', null).catch(()=>null),
        SystemSetting.getSetting('backup_google_oauth_client_secret', null).catch(()=>null),
        SystemSetting.getSetting('backup_google_oauth_refresh_token', null).catch(()=>null),
        SystemSetting.getSetting('backup_google_drive_folder_id', null).catch(()=>null)
      ])

      if (process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID) {
        this.parentFolderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID
        this.configSource.folder = 'env'
      } else if (dbFolderId) {
        this.parentFolderId = dbFolderId
        this.configSource.folder = 'db'
      }

      const envClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || null
      const envClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || null
      const envRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || null
      const hasEnvTriple = !!(envClientId && envClientSecret && envRefreshToken)
      const hasDbTriple = !!(dbClientId && dbClientSecret && dbRefreshToken)

      if (hasEnvTriple || hasDbTriple) {
        const source = hasEnvTriple ? 'env' : 'db'
        const clientId = hasEnvTriple ? envClientId : dbClientId
        const clientSecret = hasEnvTriple ? envClientSecret : dbClientSecret
        const refreshToken = hasEnvTriple ? envRefreshToken : dbRefreshToken
        this.configSource.oauth = source

        const oauth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret,
          process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://127.0.0.1:53682/oauth2callback'
        )
        oauth2Client.setCredentials({ refresh_token: refreshToken })
        this.auth = oauth2Client
        this.authMode = 'oauth'
        this.drive = google.drive({ version: 'v3', auth: this.auth })
        console.log('✅ Google Drive API initialized (OAuth user mode)')
      } else {
        const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : null
        if (!credentials) throw new Error('Missing Google auth. Provide OAuth triple or GOOGLE_SERVICE_ACCOUNT_KEY')
        this.auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] })
        this.drive = google.drive({ version: 'v3', auth: this.auth })
        this.authMode = 'service'
        console.log('✅ Google Drive API initialized (Service Account mode)')
      }

      if (this.parentFolderId) {
        await this.detectDriveType()
      }
      return true
    } catch (e) {
      console.error('Failed to initialize Google Drive API:', e.message)
      throw e
    }
  }

  async detectDriveType() {
    try {
      const fileInfo = await this.drive.files.get({ fileId: this.parentFolderId, fields: 'driveId, capabilities', supportsAllDrives: true })
      if (fileInfo.data.driveId) {
        this.driveId = fileInfo.data.driveId
        console.log(`📂 Using Shared Drive: ${this.driveId}`)
      } else {
        console.log('📂 Using My Drive folder')
      }
      if (!fileInfo.data.capabilities?.canAddChildren) {
        console.warn('⚠️  Warning: May not have write permission to this folder')
      }
    } catch (e) {
      console.warn('⚠️  Could not detect drive type:', e.message)
    }
  }

  formatDateTime(date) {
    const thaiYear = date.getFullYear() + 543
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${day}/${month}/${thaiYear} ${hours}:${minutes}:${seconds}`
  }

  async createBackupFolder() {
    const now = new Date()
    const folderName = this.formatDateTime(now)
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: this.parentFolderId ? [this.parentFolderId] : []
    }
    const folder = await this.drive.files.create({ requestBody: folderMetadata, fields: 'id, name', supportsAllDrives: true })
    console.log(`📁 Created backup folder: ${folderName} (ID: ${folder.data.id})`)
    return folder.data.id
  }

  sanitizeForJSON(data) {
    return JSON.parse(JSON.stringify(data, (key, value) => {
      if (value === undefined) return null
      if (typeof value === 'bigint') return value.toString()
      if (value instanceof Date) return value.toISOString()
      if (Buffer.isBuffer(value)) return value.toString('base64')
      if (typeof value === 'function') return null
      return value
    }))
  }

  async exportCollection(Model, collectionName) {
    const data = await Model.find({}).lean()
    const sanitizedData = this.sanitizeForJSON(data)
    return { collectionName, exportDate: new Date().toISOString(), documentCount: data.length, data: sanitizedData }
  }

  async uploadToGoogleDrive(folderId, fileName, jsonData) {
    const fileMetadata = { name: fileName, parents: [folderId], mimeType: 'application/json' }
    const jsonString = JSON.stringify(jsonData, null, 2)
    const buffer = Buffer.from(jsonString, 'utf-8')
    const stream = Readable.from(buffer)
    const params = { requestBody: fileMetadata, media: { mimeType: 'application/json', body: stream }, fields: 'id, name, size', supportsAllDrives: true, includeItemsFromAllDrives: true }
    if (this.driveId) params.driveId = this.driveId
    const response = await this.drive.files.create(params)
    return response.data
  }

  async performBackup() {
    await this.initialize()
    const folderId = await this.createBackupFolder()
    const collections = [
      { model: User, name: 'users' },
      { model: CodeRequest, name: 'code_requests' },
      { model: CustomerAccount, name: 'customer_accounts' },
      { model: TopUp, name: 'topups' },
      { model: PlanSetting, name: 'plan_settings' },
      { model: SystemSetting, name: 'system_settings' },
      { model: PointTransaction, name: 'point_transactions' },
      { model: ExtensionRequest, name: 'extension_requests' }
    ]

    const results = []
    for (const c of collections) {
      try {
        const data = await this.exportCollection(c.model, c.name)
        const baseName = c.name.replace(/_/g, '').toLowerCase()
        const fileName = `${baseName}.json`
        const upload = await this.uploadToGoogleDrive(folderId, fileName, data)
        results.push({ collection: c.name, success: true, fileId: upload.id, size: upload.size })
      } catch (e) {
        results.push({ collection: c.name, success: false, error: e.message })
      }
    }

    const summary = { backupDate: new Date().toISOString(), folderId, collections: results }
    await this.uploadToGoogleDrive(folderId, 'backupsummary.json', summary)
    return summary
  }

  async cleanupOldBackups(keepCount = 48) {
    if (!this.parentFolderId) return
    const response = await this.drive.files.list({ q: `'${this.parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id, name, createdTime)', orderBy: 'createdTime desc', supportsAllDrives: true, includeItemsFromAllDrives: true })
    const folders = response.data.files || []
    if (folders.length <= keepCount) return
    const toDelete = folders.slice(keepCount)
    for (const f of toDelete) {
      try { await this.drive.files.delete({ fileId: f.id, supportsAllDrives: true }) } catch {}
    }
  }
}

export default GoogleDriveBackupService
