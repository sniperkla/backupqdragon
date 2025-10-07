import { performBackupHandler } from '../src/handlers.js'

// Simple auth middleware for serverless
function auth(req, res, next) {
  const shared = process.env.BACKUP_SHARED_SECRET
  if (!shared) return next()
  const provided = req.headers['x-backup-secret'] || req.query.secret
  if (provided === shared) return next()
  return res.status(401).json({ error: 'Unauthorized' })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Apply auth check
  const shared = process.env.BACKUP_SHARED_SECRET
  if (shared) {
    const provided = req.headers['x-backup-secret'] || req.query.secret
    if (provided !== shared) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  // Call the handler
  return performBackupHandler(req, res)
}