import { Router } from 'express'
import analyticsRoutes from './analyticsRoutes.js'

const router = Router()

router.use('/analytics', analyticsRoutes)

export default router
