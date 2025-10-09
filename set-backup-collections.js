// Example: Set selected collections for backup
// Run this in your admin panel or database console
// Note: Collections are now fetched dynamically from the database,
// so you can add new collections and they'll be automatically included.
// No model mapping needed - everything uses raw MongoDB collections.

import SystemSetting from './src/models/systemSettingModel.js'
import { connectToDatabase } from './src/mongodb.js'

// Connect to database first
await connectToDatabase()

// Get all available collections from database
const mongoose = (await import('mongoose')).default
const db = mongoose.connection.db
const dbCollections = await db.listCollections().toArray()
const availableCollections = dbCollections.map(col => col.name)

console.log('Available collections in database:', availableCollections)

// Example configurations:

// Example 1: Backup only essential collections
const essentialCollections = availableCollections.filter(name =>
  ['users', 'code_requests', 'customer_accounts', 'system_settings'].includes(name)
)

// Example 2: Backup all collections (same as default - no setting needed)
// When no setting is configured, ALL user collections are backed up automatically

// Example 3: Backup only user-related data
const userCollections = availableCollections.filter(name =>
  ['users', 'code_requests', 'customer_accounts', 'point_transactions'].includes(name)
)

// Example 4: Backup everything except system collections
const nonSystemCollections = availableCollections.filter(name =>
  !name.includes('system') && !name.includes('log')
)

// Set the selected collections (choose one of the examples above)
const selectedCollections = essentialCollections // Change this to your preference

await SystemSetting.findOneAndUpdate(
  { key: 'backup_selected_collections' },
  {
    key: 'backup_selected_collections',
    value: selectedCollections,
    description: `Collections to include in automated backups (${selectedCollections.length} collections)`,
    category: 'backup'
  },
  { upsert: true }
)

console.log(`✅ Backup collections setting updated!`)
console.log(`📊 Selected ${selectedCollections.length} collections:`, selectedCollections)
console.log(`📊 Available collections: ${availableCollections.length}`)
console.log(`🔄 No model mapping needed - all collections use raw MongoDB access`)
console.log(`📄 Exported files are MongoDB Extended JSON arrays (ObjectId, Date, Binary support)`)
console.log(`🔄 Perfect for MongoDB Compass import/export`)
console.log(`🔄 Ready for mongoimport or MongoDB Compass import`)