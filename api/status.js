import { statusHandler } from '../src/handlers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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
  return statusHandler(req, res)
}