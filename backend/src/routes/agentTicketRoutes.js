import { Router } from 'express'
import {
  acceptAgentTicket,
  escalateAgentTicket,
  listAgentTickets,
  resolveAgentTicket,
} from '../controllers/agentTicketController.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth, requireRole('agent', 'supervisor', 'admin'))
router.get('/', listAgentTickets)
router.post('/:ticketId/accept', acceptAgentTicket)
router.post('/:ticketId/escalate', escalateAgentTicket)
router.post('/:ticketId/resolve', resolveAgentTicket)

export default router
