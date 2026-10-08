import mongoose from 'mongoose'
import Ticket from '../models/Ticket.js'
import { applyReviewDecision, triageConstants } from '../services/triageService.js'

export async function listTriageCandidates(req, res, next) {
  try {
    const tickets = await Ticket.find({ status: 'pending', 'triage.analyzedAt': { $exists: false } })
      .sort({ priority: -1, createdAt: 1 })
      .limit(100)
      .select('subject description category priority status createdAt customer')
      .populate('customer', 'fullName')
      .lean()
    return res.json({ tickets, provider: req.app.locals.triageProvider.provider })
  } catch (error) {
    return next(error)
  }
}

export async function analyzeTicket(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) {
      return res.status(404).json({ message: 'Ticket not found or no longer available for triage.' })
    }

    const ticket = await Ticket.findOne({
      _id: req.params.ticketId,
      status: 'pending',
      'triage.analyzedAt': { $exists: false },
    }).select('subject description category priority status')
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found or no longer available for triage.' })
    }

    const provider = req.app.locals.triageProvider
    const result = applyReviewDecision(await provider.analyze(ticket), triageConstants.minimumConfidence)
    const triage = { ...result, analyzedAt: new Date() }
    const status = result.reviewRequired ? 'escalated' : 'pending'
    const escalatedAt = result.reviewRequired ? new Date() : null
    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket.id, status: 'pending', 'triage.analyzedAt': { $exists: false } },
      {
        $set: {
          triage,
          status,
          escalatedAt,
          aiConfidence: result.provider === 'ai' ? result.confidence : null,
        },
      },
      { new: true, runValidators: true },
    ).populate('customer', 'fullName').lean()

    if (!updated) {
      return res.status(409).json({ message: 'Another team member triaged this ticket first. Refresh the queue.' })
    }
    return res.json({ ticket: updated })
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
    return next(error)
  }
}
