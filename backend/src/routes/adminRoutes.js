import { Router } from 'express'
import {
  adminPermissions,
  getAdminOverview,
  getAdminSettings,
  listAdminAuditLogs,
  listAdminTickets,
  listAdminUsers,
  updateAdminSettings,
  updateAdminTicket,
  updateAdminUser,
} from '../controllers/adminController.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth, requireRole('admin'))
router.get('/overview', getAdminOverview)
router.get('/users', listAdminUsers)
router.patch('/users/:userId', updateAdminUser)
router.get('/tickets', listAdminTickets)
router.patch('/tickets/:ticketId', updateAdminTicket)
router.get('/settings', getAdminSettings)
router.patch('/settings', updateAdminSettings)
router.get('/audit-logs', listAdminAuditLogs)
router.get('/permissions', (req, res) => res.json({ roles: adminPermissions }))

export default router
