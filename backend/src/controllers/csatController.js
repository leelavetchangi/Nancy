import mongoose from 'mongoose'
import CSAT from '../models/CSAT.js'
import Ticket from '../models/Ticket.js'

export function getCsatErrors(input = {}) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const errors = {}
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    errors.rating = 'Choose a satisfaction rating from 1 to 5.'
  }
  if (body.feedback !== undefined && (typeof body.feedback !== 'string' || body.feedback.trim().length > 1000)) {
    errors.feedback = 'Feedback must be 1,000 characters or fewer.'
  }
  return errors
}

export async function listCustomerSurveys(req, res, next) {
  try {
    const surveys = await CSAT.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100).lean()
    const ratedTicketIds = surveys.map((survey) => survey.ticketId)
    const tickets = await Ticket.find({
      customer: req.user.id,
      $or: [
        { status: { $in: ['resolved', 'closed'] } },
        { _id: { $in: ratedTicketIds } },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('subject category priority status createdAt updatedAt')
      .lean()
    return res.json({ tickets, surveys })
  } catch (error) {
    return next(error)
  }
}

export async function submitCustomerSurvey(req, res, next) {
  try {
    const { ticketId, rating, feedback } = req.body || {}
    const allowedKeys = ['ticketId', 'rating', 'feedback']
    if (Object.keys(req.body || {}).some((key) => !allowedKeys.includes(key))) {
      return res.status(400).json({ message: 'Only ticketId, rating, and feedback can be submitted.' })
    }
    const errors = getCsatErrors({ rating, feedback })
    if (typeof ticketId !== 'string' || !mongoose.isValidObjectId(ticketId)) {
      errors.ticketId = 'Choose a valid support ticket.'
    }
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Please correct the survey fields.', errors })
    }

    const ticket = await Ticket.findOne({
      _id: ticketId,
      customer: req.user.id,
      status: { $in: ['resolved', 'closed'] },
    }).select('_id')
    if (!ticket) {
      return res.status(404).json({ message: 'A survey can only be submitted for your own resolved ticket.' })
    }
    const existing = await CSAT.exists({ ticketId: ticket.id })
    if (existing) {
      return res.status(409).json({ message: 'Feedback has already been submitted for this ticket.' })
    }

    try {
      const [survey] = await CSAT.create([{
        ticketId: ticket.id,
        userId: req.user.id,
        rating,
        feedback: feedback?.trim() || '',
      }])
      return res.status(201).json({ survey })
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Feedback has already been submitted for this ticket.' })
      }
      throw error
    }
  } catch (error) {
    return next(error)
  }
}
