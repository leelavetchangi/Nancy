import mongoose from 'mongoose'

const ticketAttachmentSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, required: true, maxlength: 180 },
    contentType: { type: String, enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/mp4'], required: true },
    size: { type: Number, required: true, min: 1, max: 2 * 1024 * 1024 },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true },
)

ticketAttachmentSchema.index({ ticket: 1, customer: 1 })

export default mongoose.model('TicketAttachment', ticketAttachmentSchema)
