import mongoose from 'mongoose'

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: ['new', 'reviewed'], default: 'new', required: true },
  },
  { timestamps: true },
)

contactMessageSchema.index({ createdAt: -1 })

export default mongoose.model('ContactMessage', contactMessageSchema)
