import cron from 'node-cron'
import { connectToDatabase } from './mongodb.js'
import SystemSetting from './models/systemSettingModel.js'
import GoogleDriveBackupService from './lib/googleDriveBackup.js'

let currentTask = null
let currentExpr = null

const DEFAULT_EXPR = '0,30 * * * *' // every 30 minutes

function friendly(expr) {
  const s = (expr || '').trim()
  if (s === '*/15 * * * *') return 'every 15 minutes'
  if (s === '0,30 * * * *') return 'every 30 minutes'
  if (s === '0 * * * *') return 'hourly'
  if (s === '0 */2 * * *') return 'every 2 hours'
  if (s === '0 2 * * *') return 'daily at 02:00'
  return `custom (${s})`
}

function scheduleTask(expr) {
  if (currentTask) {
    try { currentTask.stop() } catch {}
    currentTask = null
  }
  currentExpr = expr
  console.log(`[Scheduler] Scheduling backup with cron: ${expr} (${friendly(expr)})`)
  currentTask = cron.schedule(expr, async () => {
    try {
      console.log('⏰ [Scheduler] Automated backup triggered')
      await connectToDatabase()
      const svc = new GoogleDriveBackupService()
      const start = Date.now()
      const result = await svc.performBackup()
      await svc.cleanupOldBackups(48)
      const dur = ((Date.now() - start)/1000).toFixed(2)
      console.log(`✅ [Scheduler] Backup completed in ${dur}s`)
    } catch (e) {
      console.error('❌ [Scheduler] Backup failed:', e.message)
    }
  }, { scheduled: true })
}

async function loadExprFromDb() {
  await connectToDatabase()
  const expr = await SystemSetting.getSetting('backup_cron_schedule', null)
  return (typeof expr === 'string' && expr.trim()) ? expr.trim() : DEFAULT_EXPR
}

export async function initScheduler() {
  try {
    const expr = await loadExprFromDb()
    scheduleTask(expr)
  } catch (e) {
    console.warn('[Scheduler] Failed to initialize from DB, using default:', e.message)
    scheduleTask(DEFAULT_EXPR)
  }

  // Lightweight poller to detect schedule changes every 60s
  setInterval(async () => {
    try {
      const expr = await loadExprFromDb()
      if (expr !== currentExpr) {
        console.log(`[Scheduler] Detected schedule change: ${currentExpr} -> ${expr}`)
        scheduleTask(expr)
      }
    } catch (e) {
      // non-fatal
    }
  }, 60000)
}
