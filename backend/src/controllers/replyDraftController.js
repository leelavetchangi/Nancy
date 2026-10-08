import mongoose from 'mongoose'
import Ticket from '../models/Ticket.js'
import Message from '../models/Message.js'
import { getDraftErrors, replyDraftConstants } from '../services/replyDraftService.js'
import { notifyDraftReady, notifyTicketResolved } from '../services/notificationService.js'

const eligibleStatuses = replyDraftConstants.eligibleStatuses

function validTicketId(ticketId) {
  return mongoose.isValidObjectId(ticketId)
}

function getDraftTicket(ticketId) {
  return Ticket.findById(ticketId)
    .populate('customer', 'fullName')
    .populate('assignedAgent', 'fullName role')
    .populate({ path: 'messages', populate: { path: 'author', select: 'fullName role' } })
    .populate('draftReply.approvedBy', 'fullName')
    .populate('draftReply.escalatedTo', 'fullName role')
    .lean()
}

export async function listReplyDraftTickets(req, res, next) {
  try {
    const tickets = await Ticket.find({
      status: { $in: eligibleStatuses },
      'draftReply.approvedAt': { $exists: false },
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .select('subject description category priority status createdAt customer assignedAgent messages draftReply')
      .slice('messages', -20)
      .populate('customer', 'fullName')
      .populate('assignedAgent', 'fullName role')
      .populate({ path: 'messages', populate: { path: 'author', select: 'fullName role' } })
      .lean()
    const provider = req.app.locals.replyDraftProvider.provider
    return res.json({ tickets, provider, providerConfigured: provider === 'ai' })
  } catch (error) {
    return next(error)
  }
}

export async function generateReplyDraft(req, res, next) {
  try {
    if (!validTicketId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const ticket = await Ticket.findOne({
      _id: req.params.ticketId,
      status: { $in: eligibleStatuses },
      'draftReply.approvedAt': { $exists: false },
    })
      .populate({ path: 'messages', populate: { path: 'author', select: 'role' } })
      .select('subject description category priority status updatedAt messages')
    if (!ticket) return res.status(404).json({ message: 'Ticket not found or no longer available for a reply draft.' })

    const generated = await req.app.locals.replyDraftProvider.generate(ticket)
    const updated = await Ticket.findOneAndUpdate(
      {
        _id: ticket.id,
        status: { $in: eligibleStatuses },
        updatedAt: ticket.updatedAt,
        'draftReply.approvedAt': { $exists: false },
      },
      {
        $set: {
          draftReply: {
            text: generated.text,
            provider: 'ai',
            confidence: generated.confidence,
            suggestedActions: generated.suggestedActions,
            generatedAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true },
    )
    if (!updated) return res.status(409).json({ message: 'The ticket changed while the draft was generating. Refresh and try again.' })
    try {
      await notifyDraftReady(req.app.get('io'), updated, req.user.id)
    } catch (notificationError) {
      console.error(`Reply draft for ticket ${updated.id} was saved, but its notification could not be saved.`, notificationError)
    }
    return res.json({ ticket: await getDraftTicket(updated.id) })
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
    return next(error)
  }
}

export async function saveReplyDraft(req, res, next) {
  try {
    if (!validTicketId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const errors = getDraftErrors({ text: req.body?.text })
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please enter a valid reply.', errors })

    const updated = await Ticket.findOneAndUpdate(
      {
        _id: req.params.ticketId,
        status: { $in: eligibleStatuses },
        'draftReply.approvedAt': { $exists: false },
      },
      {
        $set: {
          'draftReply.text': req.body.text.trim(),
          'draftReply.provider': 'manual',
          'draftReply.confidence': null,
          'draftReply.suggestedActions': [],
          'draftReply.editedAt': new Date(),
        },
      },
      { new: true, runValidators: true },
    )
    if (!updated) return res.status(404).json({ message: 'Ticket not found or no longer available for a reply draft.' })
    return res.json({ ticket: await getDraftTicket(updated.id) })
  } catch (error) {
    return next(error)
  }
}

export async function approveReplyDraft(req, res, next) {
  try {
    if (!validTicketId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const ticket = await Ticket.findOne({
      _id: req.params.ticketId,
      status: { $in: eligibleStatuses },
      'draftReply.approvedAt': { $exists: false },
    }).select('draftReply.text updatedAt')
    if (!ticket?.draftReply?.text) return res.status(409).json({ message: 'Save a reply draft before approving and sending it.' })
    const errors = getDraftErrors({ text: ticket.draftReply.text })
    if (Object.keys(errors).length) return res.status(409).json({ message: 'The saved reply is invalid. Edit it before sending.' })

    const approvedAt = new Date()
    const message = await Message.create({
      ticket: ticket.id,
      author: req.user.id,
      body: ticket.draftReply.text,
    })
    let updated
    try {
      updated = await Ticket.findOneAndUpdate(
        {
          _id: ticket.id,
          status: { $in: eligibleStatuses },
          updatedAt: ticket.updatedAt,
          'draftReply.text': ticket.draftReply.text,
          'draftReply.approvedAt': { $exists: false },
        },
        {
          $set: {
            status: 'resolved',
            'draftReply.approvedAt': approvedAt,
            'draftReply.approvedBy': req.user.id,
          },
          $push: { messages: message.id },
        },
        { new: true, runValidators: true },
      )
    } catch (error) {
      const cleanup = await Message.deleteOne({ _id: message.id })
      if (cleanup.deletedCount !== 1) console.error(`Could not clean up unapproved reply message ${message.id}.`)
      throw error
    }
    if (!updated) {
      const cleanup = await Message.deleteOne({ _id: message.id })
      if (cleanup.deletedCount !== 1) console.error(`Could not clean up unapproved reply message ${message.id}.`)
      return res.status(409).json({ message: 'The ticket or reply changed before it could be sent. Refresh and review it again.' })
    }
    try {
      await notifyTicketResolved(req.app.get('io'), updated, req.user.id)
    } catch (notificationError) {
      console.error(`Ticket ${updated.id} was resolved by an approved draft, but its notification could not be saved.`, notificationError)
    }
    return res.json({ ticket: await getDraftTicket(updated.id) })
  } catch (error) {
    return next(error)
  }
}

export async function escalateReplyTicket(req, res, next) {
  try {
    if (!validTicketId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const escalatedAt = new Date()
    const updated = await Ticket.findOneAndUpdate(
      {
        _id: req.params.ticketId,
        status: { $in: eligibleStatuses },
        'draftReply.approvedAt': { $exists: false },
      },
      {
        $set: {
          status: 'escalated',
          assignedAgent: req.user.id,
          escalatedAt,
          'draftReply.escalatedAt': escalatedAt,
          'draftReply.escalatedBy': req.user.id,
          'draftReply.escalatedTo': req.user.id,
        },
      },
      { new: true, runValidators: true },
    )
    if (!updated) return res.status(404).json({ message: 'Ticket not found or no longer available for escalation.' })
    try {
      await createNotifications({
        io: req.app.get('io'),
        roles: ['supervisor', 'admin'],
        excludeUserId: req.user.id,
        type: 'ticket_escalated',
        title: 'Ticket escalated for human review',
        message: `Ticket #${updated.id.slice(-6).toUpperCase()} needs a human review.`,
        ticketId: updated.id,
      })
    } catch (notificationError) {
      console.error(`Ticket ${updated.id} was escalated, but its notification could not be saved.`, notificationError)
    }
    return res.json({ ticket: await getDraftTicket(updated.id) })
  } catch (error) {
    return next(error)
  }
}
