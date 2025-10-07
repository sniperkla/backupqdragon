import express from 'express'
import dotenv from 'dotenv'
import { performBackupHandler, statusHandler } from './src/handlers.js'
import { initScheduler } from './src/scheduler.js'

dotenv.config()

const app = express()
app.use(express.json())

// Health
app.get('/health', (req, res) => res.json({ ok: true }))

// Optional simple shared-secret auth middleware for manual triggers
function auth(req, res, next) {
  const shared = process.env.BACKUP_SHARED_SECRET
  if (!shared) return next()
  const provided = req.headers['x-backup-secret'] || req.query.secret
  if (provided === shared) return next()
  return res.status(401).json({ error: 'Unauthorized' })
}

app.post('/backup/manual', auth, performBackupHandler)
app.get('/backup/status', auth, statusHandler)

const port = Number(process.env.PORT || 4321)
app.listen(port, () => {
  console.log(`Backup service listening on http://localhost:${port}`)
})

// Initialize internal scheduler (reads cron from DB)
initScheduler().catch((e) => console.warn('Scheduler init failed:', e.message))
