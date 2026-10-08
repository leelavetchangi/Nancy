import { Router } from 'express'
import { createTicketMessage, listTicketMessages } from '../controllers/messageController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)
router.get('/tickets/:ticketId', listTicketMessages)
router.post('/tickets/:ticketId', createTicketMessage)

export default router
