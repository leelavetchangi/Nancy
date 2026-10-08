import { Router } from 'express'
import {
  createKnowledgeArticle,
  deleteKnowledgeArticle,
  getKnowledgeArticle,
  listPopularArticles,
  searchKnowledge,
  updateKnowledgeArticle,
} from '../controllers/knowledgeController.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)
router.get('/popular', listPopularArticles)
router.get('/search', searchKnowledge)
router.post('/articles', requireRole('admin'), createKnowledgeArticle)
router.get('/articles/:articleId', getKnowledgeArticle)
router.put('/articles/:articleId', requireRole('admin'), updateKnowledgeArticle)
router.delete('/articles/:articleId', requireRole('admin'), deleteKnowledgeArticle)

export default router
