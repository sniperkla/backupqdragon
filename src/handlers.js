import { connectToDatabase } from './mongodb.js'
import GoogleDriveBackupService from './lib/googleDriveBackup.js'

export async function performBackupHandler(req, res) {
  try {
    await connectToDatabase()
    const svc = new GoogleDriveBackupService()
    const result = await svc.performBackup()
    // Cleanup toggle & mode from settings
    const SystemSetting = (await import('./models/systemSettingModel.js')).default
    const [keepDaysRaw, cleanupEnabled, cleanupMode, lastCleanupDate] = await Promise.all([
      SystemSetting.getSetting('backup_keep_days', 48).catch(() => 48),
      SystemSetting.getSetting('backup_enable_cleanup', true).catch(() => true),
      SystemSetting.getSetting('backup_cleanup_mode', 'always').catch(() => 'always'),
      SystemSetting.getSetting('backup_last_cleanup_date', null).catch(() => null)
    ])
    const keepDays = Number(keepDaysRaw) || 48

    if (cleanupEnabled) {
      const todayKey = (() => {
        const now = new Date()
        const bangkokMs = now.getTime() + (7 * 60 * 60 * 1000)
        const bd = new Date(bangkokMs)
        const y = bd.getUTCFullYear()
        const m = String(bd.getUTCMonth() + 1).padStart(2, '0')
        const d = String(bd.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      })()

      let shouldRun = true
      if (cleanupMode === 'daily-once' && lastCleanupDate === todayKey) {
        shouldRun = false
        console.log(`🧹 Skipping cleanup (already ran today: ${todayKey})`)
      }
      if (shouldRun) {
        await svc.cleanupOldBackups(keepDays)
        // Persist last cleanup date if daily-once
        if (cleanupMode === 'daily-once') {
          await SystemSetting.findOneAndUpdate(
            { key: 'backup_last_cleanup_date' },
            { key: 'backup_last_cleanup_date', value: todayKey, category: 'backup' },
            { upsert: true }
          )
        }
      }
    } else {
      console.log('🧹 Cleanup disabled by backup_enable_cleanup setting')
    }
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
    const [selectedCollections, excludeCollections, includeSystemCollections, keepDaysRaw, cleanupEnabled, cleanupMode, lastCleanupDate] = await Promise.all([
      SystemSetting.getSetting('backup_selected_collections', null).catch(() => null),
      SystemSetting.getSetting('backup_exclude_collections', []).catch(() => []),
      SystemSetting.getSetting('backup_include_system_collections', false).catch(() => false),
      SystemSetting.getSetting('backup_keep_days', 48).catch(() => 48),
      SystemSetting.getSetting('backup_enable_cleanup', true).catch(() => true),
      SystemSetting.getSetting('backup_cleanup_mode', 'always').catch(() => 'always'),
      SystemSetting.getSetting('backup_last_cleanup_date', null).catch(() => null)
    ])
    const keepDays = Number(keepDaysRaw) || 48

    // Get available collections from database
    const mongoose = (await import('mongoose')).default
    const db = mongoose.connection.db
    const dbCollections = await db.listCollections().toArray()
    const allCollections = dbCollections.map(col => col.name)
    let availableCollections = allCollections
    if (!includeSystemCollections) {
      availableCollections = availableCollections.filter(name =>
        !name.startsWith('system.') &&
        !name.startsWith('_') &&
        name !== 'sessions'
      )
    }
    const excludedBySetting = (excludeCollections || [])
    availableCollections = availableCollections.filter(n => !excludedBySetting.includes(n))

    return res.json({
      success: true,
      status: {
        enabled: !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN)),
        parentFolderId: process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || null,
        backupInterval: '30 minutes',
        retentionPolicy: `1 per day for last ${keepDays} day(s)`,
        keepDays,
        selectedCollections: selectedCollections || 'all',
        includeSystemCollections,
        excludeCollections,
        totalDbCollections: allCollections.length,
        availableCollections,
        totalAvailableCollections: availableCollections.length,
        cleanupEnabled,
        cleanupMode,
        lastCleanupDate
      }
    })
  } catch (e) {
    return res.status(500).json({ error: 'Status failed', message: e.message })
  }
}
