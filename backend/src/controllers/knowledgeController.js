import mongoose from 'mongoose'
import KnowledgeArticle from '../models/KnowledgeArticle.js'
import { getArticleErrors } from '../services/knowledgeRetrievalService.js'

function getKnowledgeService(req) {
  return req.app.locals.knowledgeRetrieval
}

export async function listPopularArticles(req, res, next) {
  try {
    const articles = await getKnowledgeService(req).popular()
    return res.json({ articles })
  } catch (error) {
    return next(error)
  }
}

export async function searchKnowledge(req, res, next) {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (query.length < 2 || query.length > 160) {
      return res.status(400).json({ message: 'Enter a search question between 2 and 160 characters.' })
    }
    const result = await getKnowledgeService(req).search(query)
    return res.json({ ...result, resultCount: result.sources.length })
  } catch (error) {
    return next(error)
  }
}

export async function getKnowledgeArticle(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.articleId)) return res.status(404).json({ message: 'Article not found.' })
    const article = await getKnowledgeService(req).getArticle(req.params.articleId)
    if (!article) return res.status(404).json({ message: 'Article not found.' })
    return res.json({ article })
  } catch (error) {
    return next(error)
  }
}

export async function createKnowledgeArticle(req, res, next) {
  try {
    const errors = getArticleErrors(req.body)
    const allowedKeys = ['title', 'summary', 'content', 'category', 'tags', 'published']
    if (Object.keys(req.body || {}).some((key) => !allowedKeys.includes(key))) {
      return res.status(400).json({ message: 'The article contains unsupported fields.' })
    }
    if (req.body?.published !== undefined && typeof req.body.published !== 'boolean') {
      errors.published = 'Publication state must be true or false.'
    }
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please correct the article fields.', errors })

    const article = await KnowledgeArticle.create({
      title: req.body.title.trim(),
      summary: req.body.summary.trim(),
      content: req.body.content.trim(),
      category: req.body.category.trim(),
      tags: req.body.tags?.map((tag) => tag.trim().toLowerCase()) || [],
      published: req.body.published ?? true,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    })
    return res.status(201).json({ article })
  } catch (error) {
    return next(error)
  }
}

export async function updateKnowledgeArticle(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.articleId)) return res.status(404).json({ message: 'Article not found.' })
    const allowedKeys = ['title', 'summary', 'content', 'category', 'tags', 'published']
    const suppliedKeys = Object.keys(req.body || {})
    if (!suppliedKeys.length || suppliedKeys.some((key) => !allowedKeys.includes(key))) {
      return res.status(400).json({ message: 'Only article fields can be updated.' })
    }
    const current = await KnowledgeArticle.findById(req.params.articleId).lean()
    if (!current) return res.status(404).json({ message: 'Article not found.' })
    const candidate = { ...current, ...req.body }
    const errors = getArticleErrors(candidate)
    if (candidate.published !== undefined && typeof candidate.published !== 'boolean') {
      errors.published = 'Publication state must be true or false.'
    }
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please correct the article fields.', errors })

    const changes = Object.fromEntries(suppliedKeys.map((key) => [
      key,
      key === 'tags' ? req.body.tags.map((tag) => tag.trim().toLowerCase()) : typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key],
    ]))
    const article = await KnowledgeArticle.findByIdAndUpdate(
      req.params.articleId,
      { $set: { ...changes, updatedBy: req.user.id } },
      { new: true, runValidators: true },
    )
    return res.json({ article })
  } catch (error) {
    return next(error)
  }
}

export async function deleteKnowledgeArticle(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.articleId)) return res.status(404).json({ message: 'Article not found.' })
    const result = await KnowledgeArticle.deleteOne({ _id: req.params.articleId })
    if (result.deletedCount !== 1) return res.status(404).json({ message: 'Article not found.' })
    return res.json({ message: 'Knowledge article deleted.' })
  } catch (error) {
    return next(error)
  }
}
