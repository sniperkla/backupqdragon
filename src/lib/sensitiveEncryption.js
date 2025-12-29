/**
 * Sensitive Data Decryption for External Backup Service
 */
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32
const SALT_LENGTH = 16
const ENCRYPTED_PREFIX = 'enc:v1:'

function getEncryptionKey() {
  const key = process.env.DB_ENCRYPTION_KEY || process.env.ENCRYPTION_SECRET_KEY || process.env.ENCRYPTION_KEY
  
  if (!key) {
    console.warn('⚠️ No encryption key found. Set DB_ENCRYPTION_KEY')
    return crypto.scryptSync('default-dev-key-change-in-production', 'salt', KEY_LENGTH)
  }
  
  if (key.length === 44) {
    return Buffer.from(key, 'base64')
  }
  
  return crypto.scryptSync(key, 'db-sensitive-salt', KEY_LENGTH)
}

export function isEncryptedValue(value) {
  if (typeof value !== 'string') return false
  return value.startsWith(ENCRYPTED_PREFIX)
}

export function decryptSensitive(encryptedData) {
  try {
    if (!encryptedData || typeof encryptedData !== 'string') return encryptedData
    if (!isEncryptedValue(encryptedData)) return encryptedData
    
    const data = encryptedData.slice(ENCRYPTED_PREFIX.length)
    const combined = Buffer.from(data, 'base64')
    
    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
    
    const key = getEncryptionKey()
    const derivedKey = crypto.scryptSync(key, salt, KEY_LENGTH)
    
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    return decrypted.toString('utf8')
  } catch (error) {
    console.error('❌ Decryption failed:', error.message)
    return encryptedData
  }
}

export function decryptIfEncrypted(value) {
  if (isEncryptedValue(value)) {
    return decryptSensitive(value)
  }
  return value
}