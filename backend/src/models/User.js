import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    mobileNumber: { type: String, required: true, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['customer', 'agent', 'supervisor', 'admin'],
      default: 'customer',
      required: true,
    },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
)

export default mongoose.model('User', userSchema)
