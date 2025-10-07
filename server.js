import express from 'express'
import dotenv from 'dotenv'
import { performBackupHandler, statusHandler } from './src/handlers.js'
import { initScheduler } from './src/scheduler.js'

dotenv.config()

const app = express()
app.use(express.json())

// Health
app.get('/health', (req, res) => res.json({ 
  ok: true, 
  timestamp: new Date().toISOString(),
  service: 'backup-service'
}))

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

async function startServer() {
  try {
    // Initialize the backup scheduler
    await initScheduler()
    console.log('✅ Backup scheduler initialized')
    
    app.listen(port, () => {
      console.log(`🚀 Backup service listening on http://localhost:${port}`)
      console.log(`📅 Automated backups are running based on database settings`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    console.warn('⚠️  Server will start but scheduler may not be working')
    
    app.listen(port, () => {
      console.log(`🚀 Backup service listening on http://localhost:${port}`)
      console.log(`⚠️  Scheduler initialization failed - only manual backups available`)
    })
  }
}

startServer()
