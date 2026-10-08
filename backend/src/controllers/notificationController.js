import mongoose from 'mongoose'
import Notification from '../models/Notification.js'

export async function listNotifications(req, res, next) {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user.id }).sort({ createdAt: -1 }).limit(100).lean(),
      Notification.countDocuments({ recipient: req.user.id, readAt: null }),
    ])
    return res.json({ notifications, unreadCount })
  } catch (error) {
    return next(error)
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.notificationId)) return res.status(404).json({ message: 'Notification not found.' })
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, recipient: req.user.id, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true },
    ).lean()
    if (!notification) {
      const exists = await Notification.exists({ _id: req.params.notificationId, recipient: req.user.id })
      if (!exists) return res.status(404).json({ message: 'Notification not found.' })
      return res.json({ notification: null, unchanged: true })
    }
    return res.json({ notification })
  } catch (error) {
    return next(error)
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, readAt: null },
      { $set: { readAt: new Date() } },
    )
    return res.json({ updatedCount: result.modifiedCount })
  } catch (error) {
    return next(error)
  }
}
