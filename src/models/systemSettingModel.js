import mongoose from 'mongoose'

const SystemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String, trim: true },
  category: { type: String, enum: ['general', 'pricing', 'features', 'limits', 'backup'], default: 'general' },
  updatedBy: { type: String, default: 'admin' }
}, { timestamps: true })

SystemSettingSchema.statics.getSetting = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key })
  return setting ? setting.value : defaultValue
}

export default mongoose.models.SystemSetting || mongoose.model('SystemSetting', SystemSettingSchema)
