import mongoose from 'mongoose'
import Message from '../models/Message.js'
import { findChatTicket } from '../services/chatAccess.js'
import { appendTicketMessage } from '../services/messageService.js'
import { notifyTicketMessage } from '../services/notificationService.js'
import { getMessageError } from './ticketController.js'

const messagePopulation = [
  { path: 'author', select: 'fullName role' },
  { path: 'attachments', select: 'originalName contentType size createdAt' },
]

export async function listTicketMessages(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const ticket = await findChatTicket(req.params.ticketId, req.user)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })

    const messages = await Message.find({ ticket: ticket.id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(200)
      .populate(messagePopulation)
      .lean()
    return res.json({ messages: messages.reverse() })
  } catch (error) {
    return next(error)
  }
}

export async function createTicketMessage(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const ticket = await findChatTicket(req.params.ticketId, req.user)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    if (ticket.status === 'closed') return res.status(409).json({ message: 'This ticket is closed and cannot receive messages.' })

    const messageError = getMessageError(req.body?.body)
    if (messageError) return res.status(400).json({ message: messageError, errors: { body: messageError } })
    const message = await appendTicketMessage(ticket, {
      author: req.user.id,
      body: req.body.body.trim(),
    })
    if (!message) return res.status(409).json({ message: 'This ticket changed before the message could be saved. Refresh and try again.' })

    const io = req.app.get('io')
    const payload = { ticketId: ticket.id, message }
    if (io) {
      io.to(`ticket:${ticket.id}`).emit('chat:message', payload)
      for (const recipient of [ticket.customer, ticket.assignedAgent].filter(Boolean)) {
        if (String(recipient) !== String(req.user.id)) {
          io.to(`user:${recipient}`).emit('chat:notification', payload)
        }
      }
      if (req.user.role === 'customer' && !ticket.assignedAgent) {
        for (const role of ['agent', 'supervisor', 'admin']) {
          io.to(`role:${role}`).emit('chat:notification', payload)
        }
      }
    }
    try {
      await notifyTicketMessage(io, ticket, req.user, req.user.role)
    } catch (notificationError) {
      console.error(`Message on ticket ${ticket.id} was saved, but its notification could not be saved.`, notificationError)
    }
    return res.status(201).json({ message })
  } catch (error) {
    return next(error)
  }
}
