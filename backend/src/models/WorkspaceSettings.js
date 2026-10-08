import mongoose from 'mongoose'

const workspaceSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'workspace' },
    workspaceName: { type: String, required: true, trim: true, maxlength: 80, default: 'NEXA Support Desk' },
    supportEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, default: 'support@nexa.support' },
  },
  { timestamps: true },
)

export default mongoose.model('WorkspaceSettings', workspaceSettingsSchema)
