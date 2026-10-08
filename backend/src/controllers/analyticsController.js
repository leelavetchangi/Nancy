import Ticket from '../models/Ticket.js'
import { buildAnalyticsReport, createAnalyticsPipeline } from '../services/analyticsService.js'

const supportedRanges = new Set([7, 30, 90])
const dayMs = 24 * 60 * 60 * 1000

export async function getSupervisorAnalytics(req, res, next) {
  try {
    const days = Number(req.query.days || 30)
    if (!supportedRanges.has(days)) {
      return res.status(400).json({ message: 'Choose an analytics range of 7, 30, or 90 days.' })
    }

    const endDate = new Date()
    endDate.setUTCHours(0, 0, 0, 0)
    endDate.setUTCDate(endDate.getUTCDate() + 1)
    const startDate = new Date(endDate.getTime() - days * dayMs)
    const [facets = {}] = await Ticket.aggregate(createAnalyticsPipeline(startDate, endDate))
    return res.json({ analytics: buildAnalyticsReport(facets, startDate, new Date(endDate.getTime() - dayMs)) })
  } catch (error) {
    return next(error)
  }
}
