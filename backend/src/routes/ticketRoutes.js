import { Router } from 'express'
import {
  addCustomerAttachments,
  addCustomerMessage,
  closeCustomerTicket,
  createCustomerTicket,
  deleteCustomerTicket,
  downloadCustomerAttachment,
  getCustomerTicket,
  listCustomerTickets,
  updateCustomerTicket,
} from '../controllers/ticketController.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import { ticketUpload } from '../middleware/ticketUploads.js'

const router = Router()

router.use(requireAuth, requireRole('customer'))
router.get('/', listCustomerTickets)
router.post('/', ticketUpload.array('attachments', 3), createCustomerTicket)
router.get('/:ticketId/attachments/:attachmentId', downloadCustomerAttachment)
router.get('/:ticketId', getCustomerTicket)
router.put('/:ticketId', updateCustomerTicket)
router.post('/:ticketId/messages', addCustomerMessage)
router.post('/:ticketId/attachments', ticketUpload.array('attachments', 3), addCustomerAttachments)
router.post('/:ticketId/close', closeCustomerTicket)
router.delete('/:ticketId', deleteCustomerTicket)

export default router
