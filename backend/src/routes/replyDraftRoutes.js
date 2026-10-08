import { Router } from 'express'
import {
  approveReplyDraft,
  escalateReplyTicket,
  generateReplyDraft,
  listReplyDraftTickets,
  saveReplyDraft,
} from '../controllers/replyDraftController.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth, requireRole('agent', 'supervisor', 'admin'))
router.get('/tickets', listReplyDraftTickets)
router.post('/tickets/:ticketId/generate', generateReplyDraft)
router.put('/tickets/:ticketId/draft', saveReplyDraft)
router.post('/tickets/:ticketId/approve', approveReplyDraft)
router.post('/tickets/:ticketId/escalate', escalateReplyTicket)

export default router
