import mongoose from 'mongoose'

const PointTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['add', 'deduct'], required: true },
  amount: { type: Number, required: true },
  note: { type: String }
}, { timestamps: true })

export default mongoose.models.PointTransaction || mongoose.model('PointTransaction', PointTransactionSchema)
