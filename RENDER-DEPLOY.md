# Render Deployment Guide

## Setup
1. Connect your GitHub repo to Render
2. Create a new Web Service
3. Use these settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

## For Cron Jobs
Create a separate "Cron Job" service in Render:
- Command: `node -e "import('./src/handlers.js').then(h => h.performBackupHandler({}, {json: console.log, status: () => ({json: console.log})})"`
- Schedule: `0 2 * * *` (daily at 2 AM)

Free tier includes cron jobs!