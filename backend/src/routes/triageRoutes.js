import { Router } from 'express'
import { analyzeTicket, listTriageCandidates } from '../controllers/triageController.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth, requireRole('agent', 'supervisor', 'admin'))
router.get('/tickets', listTriageCandidates)
router.post('/tickets/:ticketId/analyze', analyzeTicket)

export default router
