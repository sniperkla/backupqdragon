import mongoose from 'mongoose'

const TopUpSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String }
}, { timestamps: true })

export default mongoose.models.TopUp || mongoose.model('TopUp', TopUpSchema)
