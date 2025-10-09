# QDragon Backup Service

A MongoDB backup service that automatically exports database collections to Google Drive with configurable scheduling and collection selection.

## Features

- ✅ **Automated Backups** - Configurable scheduling via database settings
- ✅ **Google Drive Integration** - Secure cloud storage for backups
- ✅ **Collection Filtering** - Select which collections to backup via `backup_selected_collections` setting
- ✅ **Thai Buddhist Era Dates** - Folder names in Thai calendar format (DD/MM/YYYY)
- ✅ **Retention Policy** - Automatic cleanup of old backups
- ✅ **REST API** - Manual backup triggers and status monitoring
- ✅ **Multiple Auth Methods** - Service Account or OAuth support

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
# Database
MONGODB_URI="mongodb://username:password@host:port/database"

# Authentication
BACKUP_SHARED_SECRET="your-secret-key"

# Google Drive (choose one method):

# Method 1: Service Account (recommended)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# Method 2: OAuth (environment)
GOOGLE_OAUTH_CLIENT_ID="..."
GOOGLE_OAUTH_CLIENT_SECRET="..."
GOOGLE_OAUTH_REFRESH_TOKEN="..."

# Optional
GOOGLE_DRIVE_BACKUP_FOLDER_ID="your-folder-id"
PORT=4321
```

### Database Settings

Configure backup behavior via SystemSetting collection:

```javascript
// Set backup interval (in minutes)
await SystemSetting.findOneAndUpdate(
  { key: 'backup_interval_minutes' },
  { key: 'backup_interval_minutes', value: 30, category: 'backup' },
  { upsert: true }
)

// Set which collections to backup (optional - defaults to all)
// Collections are automatically detected from your database
await SystemSetting.findOneAndUpdate(
  { key: 'backup_selected_collections' },
  {
    key: 'backup_selected_collections',
    value: ['users', 'code_requests', 'customer_accounts'],
    category: 'backup'
  },
  { upsert: true }
)
```

**Dynamic Collection Detection**: The system now automatically discovers all collections in your database using raw MongoDB access. When you add new collections, they're automatically included in backups (unless you specify a filter in `backup_selected_collections`).

**No Model Mapping Required**: The system uses direct MongoDB collection access, so no Mongoose model configuration is needed. All collections are treated equally.

Current collections (may vary based on your database):
- `users`
- `code_requests`
- `customer_accounts`
- `topups`
- `plan_settings`
- `system_settings`
- `point_transactions`
- `extension_requests`

## Usage

### Start the Server

```bash
npm start
```

The server will:
- Start on port 4321 (or PORT env var)
- Connect to MongoDB
- Initialize Google Drive API
- Start automated backup scheduler

### API Endpoints

#### Health Check
```bash
GET /health
```

#### Manual Backup
```bash
POST /backup/manual
Header: x-backup-secret: your-secret-key
```

#### Status
```bash
GET /backup/status
Header: x-backup-secret: your-secret-key
```

Response includes:
- Backup enabled status
- Google Drive folder ID
- Backup interval
- Selected collections
- Retention policy

## Backup Process

1. **Initialization**: Connects to MongoDB and Google Drive
2. **Folder Creation**: Creates timestamped folder (DD/MM/YYYY HH:MM:SS format)
3. **Collection Export**: Exports each collection as a **pure JSON array** (MongoDB Compass compatible)
4. **Upload**: Uploads JSON files to Google Drive
5. **Cleanup**: Removes old backups (keeps last 48)

### MongoDB Compass Import

Each collection is exported as a **MongoDB Extended JSON array** that can be directly imported into MongoDB Compass:

```json
[
  {
    "_id": {
      "$oid": "68db92d7be36efb9537f1f7f"
    },
    "username": "iautba",
    "email": "iautba@gmail.com",
    "createdAt": {
      "$date": "2025-09-30T08:20:39.125Z"
    },
    "updatedAt": {
      "$date": "2025-10-05T12:28:53.321Z"
    }
  }
]
```

**Features:**
- ✅ **ObjectIds** as `{"$oid": "..."}`
- ✅ **Dates** as `{"$date": "..."}`
- ✅ **Buffers** as `{"$binary": {"base64": "...", "subType": "00"}}`
- ✅ **Compatible** with `mongoimport` and MongoDB Compass

**To import back into MongoDB Compass:**
1. Download the JSON file from Google Drive
2. Open MongoDB Compass
3. Go to your collection
4. Click "Import Data" → "JSON"
5. Select the downloaded file
6. Choose "JSON" as input format
7. Click "Import"

## Deployment

### Railway (Recommended)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Render
1. Connect GitHub repo
2. Create Web Service
3. Set build/start commands

### Traditional Server
```bash
npm install -g pm2
pm2 start server.js --name backup-service
pm2 startup
pm2 save
```

## File Structure

```
├── server.js              # Express server
├── src/
│   ├── handlers.js        # API handlers
│   ├── scheduler.js       # Cron job scheduler
│   ├── mongodb.js         # Database connection
│   ├── lib/
│   │   └── googleDriveBackup.js  # Backup logic
│   └── models/            # Mongoose models
├── set-backup-collections.js  # Configuration helper
└── package.json
```

## Security

- Use strong `BACKUP_SHARED_SECRET`
- Store Google credentials securely
- Consider IP restrictions for API access
- Regular credential rotation

## Monitoring

Check logs for:
- Backup success/failure
- Collection sizes
- Google Drive upload status
- Scheduler activity

## Troubleshooting

### Common Issues

1. **Google API Errors**: Check credentials and permissions
2. **MongoDB Connection**: Verify connection string
3. **Large Collections**: May need chunking for very large datasets
4. **Scheduler Not Running**: Check database settings and logs

### Logs

```bash
# View recent logs
tail -f logs/app.log

# Check backup status
curl -H "x-backup-secret: your-secret" http://localhost:4321/backup/status
```
