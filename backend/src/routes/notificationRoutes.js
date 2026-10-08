import { Router } from 'express'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)
router.get('/', listNotifications)
router.patch('/read-all', markAllNotificationsRead)
router.patch('/:notificationId/read', markNotificationRead)

export default router
