# QDragon Backup Service - Vercel Deployment

## Deployment Steps

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy to Vercel
```bash
vercel --prod
```

### 4. Set Environment Variables in Vercel
After deployment, go to your Vercel dashboard and set these environment variables:

**Required:**
- `MONGODB_URI` - Your MongoDB connection string
- `BACKUP_SHARED_SECRET` - Secret for API authentication
- `CRON_SECRET` - Secret for scheduled backup authentication

**Google Drive Auth (choose one):**

Option A - Service Account:
- `GOOGLE_SERVICE_ACCOUNT_KEY` - JSON string of service account credentials

Option B - OAuth (stored in database):
- Database settings via SystemSetting model

Option C - OAuth (environment variables):
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET` 
- `GOOGLE_OAUTH_REFRESH_TOKEN`

**Optional:**
- `GOOGLE_DRIVE_BACKUP_FOLDER_ID` - Target folder ID for backups

## API Endpoints

Once deployed, your endpoints will be:
- `GET /api/health` - Health check
- `POST /api/backup` - Manual backup trigger
- `GET /api/status` - Backup service status
- `POST /api/scheduled-backup` - Automated backup (Vercel Cron only)

## Scheduled Backups

The service is configured to run automated backups every 30 minutes using Vercel Cron.
You can modify the schedule in `vercel.json`:

```json
"crons": [
  {
    "path": "/api/scheduled-backup",
    "schedule": "0 */30 * * * *"  // Every 30 minutes
  }
]
```

## Manual Backup Trigger

```bash
curl -X POST https://your-app.vercel.app/api/backup \
  -H "x-backup-secret: your-secret-here"
```

## Notes

- Vercel free tier has function timeout limits (10s for hobby, 300s max for pro)
- Scheduled backups require Vercel Pro plan ($20/month)
- Free tier gets 100GB-hours of function execution time
- Consider implementing backup chunking for large databases