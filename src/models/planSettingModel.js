import mongoose from 'mongoose'

const PlanSettingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  days: { type: Number, default: 30 },
  price: { type: Number, required: true },
  points: { type: Number, required: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  isLifetime: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true })

export default mongoose.models.PlanSetting || mongoose.model('PlanSetting', PlanSettingSchema)
