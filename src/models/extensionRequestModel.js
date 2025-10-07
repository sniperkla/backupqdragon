import mongoose from 'mongoose'

const ExtensionRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  licenseCode: { type: String, required: true },
  requestedDays: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  processedAt: { type: Date },
  processedBy: { type: String },
  rejectionReason: { type: String }
}, { timestamps: true })

export default mongoose.models.ExtensionRequest || mongoose.model('ExtensionRequest', ExtensionRequestSchema)
