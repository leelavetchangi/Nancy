import mongoose from 'mongoose'

const ticketSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: {
      type: String,
      enum: ['technical', 'billing', 'account', 'product', 'other'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'ai_processing', 'assigned_to_agent', 'resolved', 'escalated', 'closed'],
      default: 'pending',
      required: true,
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    slaDueAt: { type: Date, default: null, index: true },
    slaWarningSentAt: { type: Date, default: null },
    firstResponseAt: { type: Date, default: null },
    escalatedAt: { type: Date, default: null },
    csat: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, maxlength: 500 },
      submittedAt: { type: Date },
    },
    aiConfidence: { type: Number, min: 0, max: 1, default: null },
    triage: {
      provider: { type: String, enum: ['rules', 'ai'] },
      category: { type: String, enum: ['technical', 'billing', 'account', 'product', 'other'] },
      priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      sentiment: { type: String, enum: ['positive', 'neutral', 'frustrated', 'negative'] },
      confidence: { type: Number, min: 0, max: 1 },
      recommendedTeam: { type: String, maxlength: 80 },
      rationale: { type: String, maxlength: 500 },
      reviewRequired: { type: Boolean },
      analyzedAt: { type: Date },
    },
    draftReply: {
      text: { type: String, maxlength: 2000 },
      provider: { type: String, enum: ['ai', 'manual'] },
      confidence: { type: Number, min: 0, max: 1, default: null },
      suggestedActions: [{ type: String, maxlength: 120 }],
      generatedAt: { type: Date },
      editedAt: { type: Date },
      approvedAt: { type: Date },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      escalatedAt: { type: Date },
      escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TicketAttachment' }],
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  },
  { timestamps: true },
)

ticketSchema.index({ customer: 1, createdAt: -1 })
ticketSchema.index({ createdAt: 1 })
ticketSchema.index({ status: 1, slaWarningSentAt: 1, slaDueAt: 1 })

export default mongoose.model('Ticket', ticketSchema)
