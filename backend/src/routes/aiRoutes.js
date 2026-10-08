import { Router } from 'express'
import replyDraftRoutes from './replyDraftRoutes.js'
import triageRoutes from './triageRoutes.js'

const router = Router()

router.use('/triage', triageRoutes)
router.use('/replies', replyDraftRoutes)

export default router
