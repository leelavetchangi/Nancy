import { Router } from 'express'
import { login, logout, me, register, session } from '../controllers/authController.js'
import { optionalAuth, requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/session', optionalAuth, session)
router.get('/me', requireAuth, me)
router.post('/logout', logout)

export default router
