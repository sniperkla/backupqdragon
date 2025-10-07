import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  preferredLanguage: { type: String, enum: ['en', 'th'], default: 'en' },
  points: { type: Number, default: 0 },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date }
}, { timestamps: true })

export default mongoose.models.User || mongoose.model('User', UserSchema)
