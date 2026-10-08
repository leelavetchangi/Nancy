import { Router } from 'express'
import { getSupervisorAnalytics } from '../controllers/analyticsController.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth, requireRole('supervisor', 'admin'))
router.get('/', getSupervisorAnalytics)

export default router
