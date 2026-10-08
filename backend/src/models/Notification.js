import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: ['ticket_assigned', 'ai_draft_ready', 'ticket_escalated', 'sla_warning', 'customer_message', 'ticket_resolved'],
    },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 240 },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
)

notificationSchema.index({ recipient: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)
