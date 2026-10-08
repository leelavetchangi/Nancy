import KnowledgeArticle from '../models/KnowledgeArticle.js'

const maximumResults = 10

export function getArticleErrors(input = {}) {
  const { title, summary, content, category, tags } = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const errors = {}
  if (typeof title !== 'string' || title.trim().length < 4 || title.trim().length > 160) {
    errors.title = 'Enter an article title between 4 and 160 characters.'
  }
  if (typeof summary !== 'string' || summary.trim().length < 10 || summary.trim().length > 320) {
    errors.summary = 'Enter a summary between 10 and 320 characters.'
  }
  if (typeof content !== 'string' || content.trim().length < 30 || content.trim().length > 12000) {
    errors.content = 'Enter article content between 30 and 12,000 characters.'
  }
  if (typeof category !== 'string' || category.trim().length < 2 || category.trim().length > 60) {
    errors.category = 'Enter a category between 2 and 60 characters.'
  }
  if (tags !== undefined && (!Array.isArray(tags) || tags.length > 12 || tags.some((tag) => typeof tag !== 'string' || tag.trim().length < 1 || tag.trim().length > 40))) {
    errors.tags = 'Use up to 12 tags, each between 1 and 40 characters.'
  }
  return errors
}

export function createArticleSnippet(article, query) {
  const text = `${article.summary} ${article.content}`.replace(/\s+/g, ' ').trim()
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 1)
  const normalized = text.toLowerCase()
  const matchAt = terms
    .map((term) => normalized.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0]
  const start = matchAt == null ? 0 : Math.max(0, matchAt - 90)
  const snippet = text.slice(start, start + 260).trim()
  return `${start > 0 ? '…' : ''}${snippet}${start + 260 < text.length ? '…' : ''}`
}

export class MongoKeywordRetriever {
  async popular(limit = 6) {
    return KnowledgeArticle.find({ published: true })
      .sort({ views: -1, updatedAt: -1 })
      .limit(limit)
      .select('title summary category tags views updatedAt')
      .lean()
  }

  async retrieve(query, limit = maximumResults) {
    const articles = await KnowledgeArticle.find({ $text: { $search: query }, published: true })
      .sort({ score: { $meta: 'textScore' }, updatedAt: -1 })
      .limit(limit)
      .select({
        title: 1,
        summary: 1,
        content: 1,
        category: 1,
        tags: 1,
        views: 1,
        updatedAt: 1,
        score: { $meta: 'textScore' },
      })
      .lean()

    return articles.map((article) => ({
      id: String(article._id),
      title: article.title,
      summary: article.summary,
      category: article.category,
      tags: article.tags,
      updatedAt: article.updatedAt,
      score: article.score,
      snippet: createArticleSnippet(article, query),
      content: article.content,
    }))
  }

  async getPublishedArticle(articleId) {
    return KnowledgeArticle.findOneAndUpdate(
      { _id: articleId, published: true },
      { $inc: { views: 1 } },
      { new: true },
    ).select('title summary content category tags views updatedAt createdAt').lean()
  }
}

export function createKnowledgeRetrievalService({ retriever = new MongoKeywordRetriever(), answerer = null } = {}) {
  return Object.freeze({
    provider: 'mongodb-keyword',
    answerProvider: answerer?.provider || 'unconfigured',
    async popular() {
      return retriever.popular()
    },
    async search(query) {
      const retrievedSources = await retriever.retrieve(query)
      const generated = answerer ? await answerer.answer({ query, sources: retrievedSources }) : null
      if (generated && (typeof generated.text !== 'string' || !generated.text.trim())) {
        throw new Error('The configured knowledge answer provider returned an invalid answer.')
      }
      return {
        query,
        answer: generated?.text || null,
        answerProvider: generated ? answerer.provider : 'unconfigured',
        retrievalProvider: 'mongodb-keyword',
        sources: retrievedSources.map(({ content, score, ...source }) => source),
      }
    },
    async getArticle(articleId) {
      return retriever.getPublishedArticle(articleId)
    },
  })
}
