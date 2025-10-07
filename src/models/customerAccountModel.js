import mongoose from 'mongoose'

const CustomerAccountSchema = new mongoose.Schema({
  user: { type: String, required: true },
  license: { type: String, required: true },
  accountNumber: { type: String, required: true },
  platform: { type: String, enum: ['mt4', 'mt5'], default: 'mt4' },
  expireDate: { type: String },
  status: { type: String, enum: ['valid', 'expired', 'suspended'], default: 'valid' }
}, { timestamps: true })

CustomerAccountSchema.index({ user: 1 })
CustomerAccountSchema.index({ license: 1 })
CustomerAccountSchema.index({ accountNumber: 1 })

export default mongoose.models.CustomerAccount || mongoose.model('CustomerAccount', CustomerAccountSchema)
