import Ticket from '../models/Ticket.js'
import { notifySlaWarning } from './notificationService.js'

export function startSlaNotificationScheduler({ io, intervalMs = 60_000, clock = () => new Date() }) {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      const now = clock()
      const tickets = await Ticket.find({
        status: { $in: ['pending', 'assigned_to_agent', 'escalated'] },
        slaDueAt: { $gt: now, $lte: new Date(now.getTime() + 15 * 60_000) },
        slaWarningSentAt: null,
      }).sort({ slaDueAt: 1 }).limit(300).select('_id subject customer assignedAgent')

      for (const candidate of tickets) {
        const claimed = await Ticket.findOneAndUpdate(
          { _id: candidate.id, status: { $in: ['pending', 'assigned_to_agent', 'escalated'] }, slaWarningSentAt: null },
          { $set: { slaWarningSentAt: now } },
          { new: true },
        )
        if (!claimed) continue
        try {
          await notifySlaWarning(io, claimed)
        } catch (notificationError) {
          await Ticket.updateOne(
            { _id: claimed.id, slaWarningSentAt: now },
            { $unset: { slaWarningSentAt: 1 } },
          )
          console.error(`SLA warning for ticket ${claimed.id} could not be saved and will be retried.`, notificationError)
        }
      }
    } catch (error) {
      console.error('Could not dispatch SLA warning notifications.', error)
    } finally {
      running = false
    }
  }
  const timer = setInterval(run, intervalMs)
  timer.unref()
  void run()
  return () => clearInterval(timer)
}
