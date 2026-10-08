import { Router } from 'express'
import { me } from '../controllers/authController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.get('/me', requireAuth, me)

export default router
