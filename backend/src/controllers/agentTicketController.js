import mongoose from 'mongoose'
import Ticket from '../models/Ticket.js'
import User from '../models/User.js'
import { getSlaDeadline, getSlaState } from '../services/slaService.js'
import { staffRoles } from '../services/chatAccess.js'
import { notifyTicketAssignee, notifyTicketCustomer, notifyTicketResolved } from '../services/notificationService.js'

const actionableStatuses = ['pending', 'assigned_to_agent', 'escalated']

function withSla(ticket, now = Date.now()) {
  const slaDueAt = ticket.slaDueAt || getSlaDeadline(ticket.createdAt, ticket.priority)
  return { ...ticket, slaDueAt, sla: getSlaState(slaDueAt, now) }
}

function getAgentTicketDetails(ticketId) {
  return Ticket.findById(ticketId)
    .populate('customer', 'fullName email')
    .populate('assignedAgent', 'fullName role')
    .populate({
      path: 'messages',
      populate: [
        { path: 'author', select: 'fullName role' },
        { path: 'attachments', select: 'originalName contentType size createdAt' },
      ],
    })
    .lean()
}

export async function listAgentTickets(req, res, next) {
  try {
    if (!staffRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access support queues.' })
    }
    const query = { status: { $in: actionableStatuses } }
    if (req.user.role === 'agent') {
      query.$or = [{ assignedAgent: null }, { assignedAgent: req.user.id }]
    }
    const tickets = await Ticket.find(query)
      .sort({ createdAt: 1 })
      .limit(300)
      .select('subject description category priority status createdAt updatedAt customer assignedAgent slaDueAt firstResponseAt messages draftReply')
      .slice('messages', -1)
      .populate('customer', 'fullName')
      .populate('assignedAgent', 'fullName role')
      .populate({ path: 'messages', populate: { path: 'author', select: 'fullName role' } })
      .lean()
    const now = Date.now()
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const orderedTickets = tickets
      .map((ticket) => withSla(ticket, now))
      .sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority] || new Date(left.createdAt) - new Date(right.createdAt))
    return res.json({ tickets: orderedTickets, serverTime: now })
  } catch (error) {
    return next(error)
  }
}

export async function acceptAgentTicket(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const candidate = await Ticket.findOne({
      _id: req.params.ticketId,
      status: { $in: ['pending', 'escalated'] },
      assignedAgent: null,
    }).select('createdAt priority slaDueAt')
    if (!candidate) return res.status(409).json({ message: 'This ticket has already been assigned or is no longer available.' })
    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: candidate.id,
        status: { $in: ['pending', 'escalated'] },
        assignedAgent: null,
      },
      {
        $set: {
          assignedAgent: req.user.id,
          status: 'assigned_to_agent',
          slaDueAt: candidate.slaDueAt || getSlaDeadline(candidate.createdAt, candidate.priority),
        },
      },
      { new: true, runValidators: true },
    )
      .populate('customer', 'fullName')
      .populate('assignedAgent', 'fullName role')
      .lean()
    if (!ticket) {
      return res.status(409).json({ message: 'This ticket has already been assigned or is no longer available.' })
    }
    const ticketId = String(ticket._id)
    const io = req.app.get('io')
    if (io) io.to(`ticket:${ticketId}`).emit('ticket:updated', { ticketId, status: ticket.status, assignedAgent: ticket.assignedAgent })
    try {
      await notifyTicketCustomer(io, ticket, req.user.id, {
        type: 'ticket_assigned',
        title: 'An agent picked up your ticket',
        message: `Your ticket #${ticketId.slice(-6).toUpperCase()} is now being handled by support.`,
      })
    } catch (notificationError) {
      console.error(`Ticket ${ticketId} was assigned, but its customer notification could not be saved.`, notificationError)
    }
    return res.json({ ticket: withSla(ticket) })
  } catch (error) {
    return next(error)
  }
}

export async function escalateAgentTicket(req, res, next) {
  try {
    if (req.user.role !== 'agent') {
      return res.status(403).json({ message: 'Only an agent can hand off a ticket to the supervisor queue.' })
    }
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const supervisor = await User.findOne({ role: 'supervisor', isActive: true }).select('_id')
      || await User.findOne({ role: 'admin', isActive: true }).select('_id')
    if (!supervisor) {
      return res.status(409).json({ message: 'No active supervisor is available to receive this escalation.' })
    }
    const query = {
      _id: req.params.ticketId,
      status: { $in: actionableStatuses },
      $or: [{ assignedAgent: null }, { assignedAgent: req.user.id }],
    }
    const ticket = await Ticket.findOneAndUpdate(
      query,
      {
        $set: { status: 'escalated', assignedAgent: supervisor.id, escalatedAt: new Date() },
      },
      { new: true, runValidators: true },
    )
      .populate('customer', 'fullName')
      .populate('assignedAgent', 'fullName role')
      .lean()
    if (!ticket) return res.status(409).json({ message: 'This ticket is no longer available in your queue.' })
    const ticketId = String(ticket._id)
    const io = req.app.get('io')
    if (io) io.to(`ticket:${ticketId}`).emit('ticket:updated', { ticketId, status: ticket.status, assignedAgent: ticket.assignedAgent })
    try {
      await Promise.all([
        notifyTicketAssignee(io, ticket, req.user.id, { type: 'ticket_escalated', title: 'Ticket escalated to you' }),
        notifyTicketCustomer(io, ticket, req.user.id, {
          type: 'ticket_escalated',
          title: 'Your ticket was escalated',
          message: `Ticket #${ticketId.slice(-6).toUpperCase()} has been escalated for additional support.`,
        }),
      ])
    } catch (notificationError) {
      console.error(`Ticket ${ticketId} was escalated, but its notifications could not all be saved.`, notificationError)
    }
    return res.json({ ticket: withSla(ticket) })
  } catch (error) {
    return next(error)
  }
}

export async function resolveAgentTicket(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const query = {
      _id: req.params.ticketId,
      status: { $in: ['assigned_to_agent', 'escalated'] },
    }
    if (req.user.role === 'agent') query.assignedAgent = req.user.id
    const ticket = await Ticket.findOneAndUpdate(
      query,
      {
        $set: { status: 'resolved' },
      },
      { new: true, runValidators: true },
    )
      .populate('customer', 'fullName')
      .populate('assignedAgent', 'fullName role')
      .lean()
    if (!ticket) {
      return res.status(409).json({ message: 'Only an assigned, active ticket can be resolved. Accept it first or refresh the queue.' })
    }
    const ticketId = String(ticket._id)
    const io = req.app.get('io')
    if (io) io.to(`ticket:${ticketId}`).emit('ticket:updated', { ticketId, status: ticket.status })
    try {
      await notifyTicketResolved(io, ticket, req.user.id)
    } catch (notificationError) {
      console.error(`Ticket ${ticketId} was resolved, but its customer notification could not be saved.`, notificationError)
    }
    return res.json({ ticket: withSla(ticket) })
  } catch (error) {
    return next(error)
  }
}
