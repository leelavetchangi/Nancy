import { Router } from 'express'
import {
  addChatAttachment,
  downloadChatAttachment,
  getChatTicket,
  listChatTickets,
} from '../controllers/chatController.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { chatUpload } from '../middleware/ticketUploads.js'

const router = Router()

router.use(requireAuth)
router.get('/tickets', listChatTickets)
router.get('/tickets/:ticketId', getChatTicket)
router.post('/tickets/:ticketId/attachments', chatUpload.single('attachment'), addChatAttachment)
router.get('/tickets/:ticketId/attachments/:attachmentId', downloadChatAttachment)

export default router
