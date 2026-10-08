import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, required: true, enum: ['user', 'ticket', 'settings'] },
    targetId: { type: String, required: true, maxlength: 80 },
    summary: { type: String, required: true, maxlength: 240 },
  },
  { timestamps: true, collection: 'adminauditlogs' },
)

auditLogSchema.index({ createdAt: -1 })

export default mongoose.model('AuditLog', auditLogSchema)
