import { performBackupHandler } from '../src/handlers.js'

export default async function handler(req, res) {
  // Only allow POST requests and verify it's from Vercel Cron
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify the request is from Vercel Cron (check authorization header)
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Create a mock request/response for the handler
    const mockReq = { method: 'POST', body: {} }
    const mockRes = {
      json: (data) => res.json(data),
      status: (code) => ({ json: (data) => res.status(code).json(data) })
    }

    return await performBackupHandler(mockReq, mockRes)
  } catch (error) {
    console.error('Scheduled backup failed:', error)
    return res.status(500).json({ 
      error: 'Scheduled backup failed', 
      message: error.message 
    })
  }
}