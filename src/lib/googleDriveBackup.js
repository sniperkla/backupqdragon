// Minimal copy specialized for the standalone service
import { google } from 'googleapis'
import { Readable } from 'stream'
import path from 'path'
import mongoose from 'mongoose'
import SystemSetting from '../models/systemSettingModel.js'
import { connectToDatabase } from '../mongodb.js'

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
    // Recursively convert to MongoDB Extended JSON format
    const convertToExtendedJSON = (obj) => {
      if (obj === null || obj === undefined) return null
      if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return obj
      if (typeof obj === 'bigint') return obj.toString()
      if (Buffer.isBuffer(obj)) return { $binary: obj.toString('base64') }
      if (obj instanceof Date) return { $date: obj.toISOString() }

      // Handle ObjectId
      if (obj && typeof obj === 'object' && obj.constructor && obj.constructor.name === 'ObjectId') {
        return { $oid: obj.toString() }
      }

      if (Array.isArray(obj)) {
        return obj.map(item => convertToExtendedJSON(item))
      }

      if (typeof obj === 'object') {
        const result = {}
        for (const [key, value] of Object.entries(obj)) {
          if (value === undefined) continue // Skip undefined values
          result[key] = convertToExtendedJSON(value)
        }
        return result
      }

      return obj
    }

    return convertToExtendedJSON(data)
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

    // Get selected collections from database setting
    const selectedCollections = await SystemSetting.getSetting('backup_selected_collections', null)
    console.log('Selected collections setting:', selectedCollections)

    // Get all collections from database dynamically
    const db = mongoose.connection.db
    const collections = await db.listCollections().toArray()
    const collectionNames = collections.map(col => col.name)

    // Filter out system collections
    const userCollections = collectionNames.filter(name =>
      !name.startsWith('system.') &&
      !name.startsWith('_') &&
      name !== 'sessions'
    )

    console.log('Available collections in database:', userCollections)

    // Filter collections based on setting, or use all if no setting
    let collectionsToBackup = userCollections
    if (selectedCollections && Array.isArray(selectedCollections) && selectedCollections.length > 0) {
      collectionsToBackup = userCollections.filter(name => selectedCollections.includes(name))
      console.log(`Backing up ${collectionsToBackup.length} selected collections:`, collectionsToBackup)
    } else {
      console.log('No collection filter set, backing up all collections')
    }

    const results = []
    for (const collectionName of collectionsToBackup) {
      try {
        // Use raw MongoDB collection for all collections
        const collection = db.collection(collectionName)
        const documents = await collection.find({}).toArray()
        const sanitizedDocuments = this.sanitizeForJSON(documents)

        // Export as pure JSON array (MongoDB Compass compatible)
        const jsonString = JSON.stringify(sanitizedDocuments, null, 2)
        const buffer = Buffer.from(jsonString, 'utf-8')
        const stream = Readable.from(buffer)

        const fileMetadata = {
          name: `${collectionName}.json`,
          parents: [folderId],
          mimeType: 'application/json'
        }

        const params = {
          requestBody: fileMetadata,
          media: { mimeType: 'application/json', body: stream },
          fields: 'id, name, size',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        }
        if (this.driveId) params.driveId = this.driveId

        const upload = await this.drive.files.create(params)
        results.push({
          collection: collectionName,
          success: true,
          fileId: upload.id,
          size: upload.size,
          documentCount: documents.length
        })
      } catch (e) {
        results.push({ collection: collectionName, success: false, error: e.message })
      }
    }

    const summary = {
      backupDate: new Date().toISOString(),
      folderId,
      collections: results,
      totalCollections: results.length,
      successfulBackups: results.filter(r => r.success).length,
      failedBackups: results.filter(r => !r.success).length
    }
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
