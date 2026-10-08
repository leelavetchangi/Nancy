import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TicketAttachment' }],
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
)

messageSchema.index({ ticket: 1, createdAt: 1 })
messageSchema.index({ ticket: 1, author: 1, readAt: 1 })

export default mongoose.model('Message', messageSchema)
