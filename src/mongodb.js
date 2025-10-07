import mongoose from 'mongoose'

let isConnected = false

export async function connectToDatabase() {
  if (isConnected) return mongoose
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set in backup-service env')
  await mongoose.connect(uri, { autoIndex: false })
  isConnected = true
  return mongoose
}
