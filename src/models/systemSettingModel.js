import mongoose from 'mongoose'
import { decryptIfEncrypted } from '../lib/sensitiveEncryption.js'
const SystemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      default: 'general'
    },
    isEncrypted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)
// Static method to get setting by key (DECRYPTS automatically)
SystemSettingSchema.statics.getSetting = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key })
  if (!setting) return defaultValue
  
  // Decrypt if the value is encrypted
  const value = decryptIfEncrypted(setting.value)
  return value
}
// Static method to get setting without decryption (raw value)
SystemSettingSchema.statics.getSettingRaw = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key })
  return setting ? setting.value : defaultValue
}
export default mongoose.models.SystemSetting || mongoose.model('SystemSetting', SystemSettingSchema)