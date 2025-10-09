import { connectToDatabase } from './mongodb.js'
import GoogleDriveBackupService from './lib/googleDriveBackup.js'

export async function performBackupHandler(req, res) {
  try {
    await connectToDatabase()
    const svc = new GoogleDriveBackupService()
    const result = await svc.performBackup()
    await svc.cleanupOldBackups(48)
    return res.json({ success: true, result })
  } catch (e) {
    console.error('Manual backup failed:', e)
    return res.status(500).json({ error: 'Backup failed', message: e.message })
  }
}

export async function statusHandler(req, res) {
  try {
    await connectToDatabase()
    const SystemSetting = (await import('./models/systemSettingModel.js')).default
    const selectedCollections = await SystemSetting.getSetting('backup_selected_collections', null)

    // Get available collections from database
    const mongoose = (await import('mongoose')).default
    const db = mongoose.connection.db
    const dbCollections = await db.listCollections().toArray()
    const availableCollections = dbCollections.map(col => col.name)

    return res.json({
      success: true,
      status: {
        enabled: !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN)),
        parentFolderId: process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || null,
        backupInterval: '30 minutes',
        retentionPolicy: '48 backups (24 hours)',
        selectedCollections: selectedCollections || 'all',
        availableCollections: availableCollections,
        totalCollections: availableCollections.length
      }
    })
  } catch (e) {
    return res.status(500).json({ error: 'Status failed', message: e.message })
  }
}
