import { Router } from 'express'
import { listCustomerSurveys, submitCustomerSurvey } from '../controllers/csatController.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth, requireRole('customer'))
router.get('/', listCustomerSurveys)
router.post('/', submitCustomerSurvey)

export default router
