import mongoose from 'mongoose'
import Ticket from '../models/Ticket.js'
import TicketAttachment from '../models/TicketAttachment.js'
import { attachmentRecord, getAttachmentErrors } from './ticketController.js'
import { findChatTicket, staffRoles } from '../services/chatAccess.js'
import { notifyTicketMessage } from '../services/notificationService.js'
import { appendTicketMessage } from '../services/messageService.js'

const maximumAttachmentCount = 3

function getChatDetails(ticketId) {
  return Ticket.findById(ticketId)
    .populate('customer', 'fullName role')
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

export async function listChatTickets(req, res, next) {
  try {
    const query = { status: { $ne: 'closed' } }
    if (req.user.role === 'customer') query.customer = req.user.id
    else if (staffRoles.includes(req.user.role)) query.status = { $in: ['pending', 'ai_processing', 'assigned_to_agent', 'resolved', 'escalated'] }
    else return res.status(403).json({ message: 'You do not have permission to access live chat.' })

    const tickets = await Ticket.find(query)
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('subject category priority status createdAt updatedAt customer assignedAgent messages')
      .slice('messages', -1)
      .populate('customer', 'fullName role')
      .populate('assignedAgent', 'fullName role')
      .populate({
        path: 'messages',
        populate: [
          { path: 'author', select: 'fullName role' },
          { path: 'attachments', select: 'originalName contentType size createdAt' },
        ],
      })
      .lean()
    return res.json({ tickets })
  } catch (error) {
    return next(error)
  }
}

export async function getChatTicket(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const ticket = await findChatTicket(req.params.ticketId, req.user)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    return res.json({ ticket: await getChatDetails(ticket.id) })
  } catch (error) {
    return next(error)
  }
}

export async function addChatAttachment(req, res, next) {
  let attachment
  let messagePersisted = false
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const ticket = await findChatTicket(req.params.ticketId, req.user)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    if (ticket.status === 'closed') return res.status(409).json({ message: 'This ticket is closed and cannot receive attachments.' })
    if (!req.file) return res.status(400).json({ message: 'Choose an attachment to send.' })
    if (ticket.attachments.length >= maximumAttachmentCount) return res.status(400).json({ message: 'This ticket has reached its limit of 3 attachments.' })
    const attachmentError = getAttachmentErrors([req.file])
    if (attachmentError) return res.status(400).json({ message: attachmentError })

    const [createdAttachment] = await TicketAttachment.create([
      attachmentRecord(req.file, ticket.id, ticket.customer),
    ])
    attachment = createdAttachment
    ticket.attachments.push(attachment.id)
    await ticket.save()
    const message = await appendTicketMessage(ticket, {
      author: req.user.id,
      body: req.file.mimetype.startsWith('audio/') ? 'Voice message' : 'Shared an attachment',
      attachments: [attachment.id],
    })
    if (!message) {
      const detached = await Ticket.updateOne({ _id: ticket.id }, { $pull: { attachments: attachment.id } })
      if (detached.modifiedCount !== 1) console.error(`Could not remove unsent attachment ${attachment.id} from ticket ${ticket.id}.`)
      const cleanup = await TicketAttachment.deleteOne({ _id: attachment.id })
      if (cleanup.deletedCount !== 1) console.error(`Could not clean up unsent chat attachment ${attachment.id}.`)
      attachment = null
      return res.status(409).json({ message: 'This ticket changed before the attachment could be sent. Refresh and try again.' })
    }
    messagePersisted = true
    if (ticket.status === 'resolved') ticket.status = 'pending'

    const details = await getChatDetails(ticket.id)
    const payload = { ticketId: ticket.id, message }
    const io = req.app.get('io')
    if (io) {
      io.to(`ticket:${ticket.id}`).emit('chat:message', payload)
      for (const recipient of [ticket.customer, ticket.assignedAgent].filter(Boolean)) {
        if (String(recipient) !== String(req.user.id)) io.to(`user:${recipient}`).emit('chat:notification', payload)
      }
      if (req.user.role === 'customer' && !ticket.assignedAgent) {
        for (const role of ['agent', 'supervisor', 'admin']) io.to(`role:${role}`).emit('chat:notification', payload)
      }
    }
    try {
      await notifyTicketMessage(io, ticket, req.user, req.user.role)
    } catch (notificationError) {
      console.error(`Chat message on ticket ${ticket.id} was saved, but its notification could not be saved.`, notificationError)
    }
    return res.status(201).json({ ticket: details, message })
  } catch (error) {
    if (attachment && !messagePersisted) {
      const detached = await Ticket.updateOne({ _id: attachment.ticket }, { $pull: { attachments: attachment.id } })
      if (detached.modifiedCount !== 1) console.error(`Could not remove failed attachment ${attachment.id} from ticket ${attachment.ticket}.`)
      const cleanup = await TicketAttachment.deleteOne({ _id: attachment.id })
      if (cleanup.deletedCount !== 1) console.error(`Could not clean up chat attachment ${attachment.id} after message save failed.`)
    }
    return next(error)
  }
}

export async function downloadChatAttachment(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId) || !mongoose.isValidObjectId(req.params.attachmentId)) {
      return res.status(404).json({ message: 'Attachment not found.' })
    }
    const ticket = await findChatTicket(req.params.ticketId, req.user)
    if (!ticket) return res.status(404).json({ message: 'Attachment not found.' })
    const attachment = await TicketAttachment.findOne({
      _id: req.params.attachmentId,
      ticket: ticket.id,
      customer: ticket.customer,
    }).select('+data').lean()
    if (!attachment) return res.status(404).json({ message: 'Attachment not found.' })
    const inline = attachment.contentType.startsWith('audio/') || attachment.contentType.startsWith('image/')
    res.set({
      'Content-Type': attachment.contentType,
      'Content-Length': attachment.size,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${attachment.originalName.replace(/["\\]/g, '_')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    })
    return res.send(attachment.data)
  } catch (error) {
    return next(error)
  }
}
