import mongoose from 'mongoose'

const knowledgeArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    summary: { type: String, required: true, trim: true, maxlength: 320 },
    content: { type: String, required: true, trim: true, maxlength: 12000 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    tags: { type: [String], default: [], validate: [(tags) => tags.length <= 12, 'An article may have at most 12 tags.'] },
    published: { type: Boolean, default: true, index: true },
    views: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

knowledgeArticleSchema.index({ title: 'text', summary: 'text', content: 'text', tags: 'text' })
knowledgeArticleSchema.index({ published: 1, views: -1, updatedAt: -1 })

export default mongoose.model('KnowledgeArticle', knowledgeArticleSchema)
