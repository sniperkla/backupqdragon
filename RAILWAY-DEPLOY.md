# Railway Deployment Guide

## Setup
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`  
3. Initialize: `railway init`
4. Deploy: `railway up`

## Environment Variables
Set these in Railway dashboard:
- MONGODB_URI
- BACKUP_SHARED_SECRET
- GOOGLE_SERVICE_ACCOUNT_KEY (or OAuth credentials)
- GOOGLE_DRIVE_BACKUP_FOLDER_ID

## For Scheduled Backups
Railway supports cron jobs natively. Create a cron service or use your existing server.js with node-cron.

Railway pricing: $5/month gets you plenty of resources for this backup service.