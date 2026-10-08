import mongoose from 'mongoose'

const csatSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    feedback: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true, collection: 'csat_surveys' },
)

csatSchema.index({ createdAt: -1 })

export default mongoose.model('CSAT', csatSchema)
