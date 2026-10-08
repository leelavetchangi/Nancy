import mongoose from 'mongoose'
import Ticket from '../models/Ticket.js'
import Message from '../models/Message.js'
import TicketAttachment from '../models/TicketAttachment.js'
import { getSlaDeadline } from '../services/slaService.js'
import { notifySupportOfNewTicket, notifyTicketMessage } from '../services/notificationService.js'
import { appendTicketMessage } from '../services/messageService.js'

const categories = ['technical', 'billing', 'account', 'product', 'other']
const priorities = ['low', 'medium', 'high', 'critical']
const maximumAttachmentCount = 3
const maximumAttachmentSize = 2 * 1024 * 1024

export function getTicketErrors({ subject, description, category, priority }) {
  const errors = {}
  if (typeof subject !== 'string' || subject.trim().length < 4 || subject.trim().length > 120) {
    errors.subject = 'Enter a subject between 4 and 120 characters.'
  }
  if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 5000) {
    errors.description = 'Enter a description between 10 and 5,000 characters.'
  }
  if (!categories.includes(category)) {
    errors.category = 'Choose a valid ticket category.'
  }
  if (!priorities.includes(priority)) {
    errors.priority = 'Choose a valid priority.'
  }
  return errors
}

export function getMessageError(body) {
  if (typeof body !== 'string' || body.trim().length < 1 || body.trim().length > 2000) {
    return 'Enter a message of up to 2,000 characters.'
  }
  return null
}

export function canCustomerEditTicket(ticket) {
  return ticket.status === 'pending' && !ticket.assignedAgent && ticket.messages.length === 0
}

export function canCustomerDeleteTicket(ticket) {
  return canCustomerEditTicket(ticket)
}

function safeFileName(name) {
  return name
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\w.() -]/g, '_')
    .trim()
    .slice(-180) || 'attachment'
}

export function detectAttachmentType(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'audio/webm'
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4'
  return null
}

export function getAttachmentErrors(files = []) {
  if (!Array.isArray(files) || files.length > maximumAttachmentCount) {
    return 'Attach no more than 3 files.'
  }
  for (const file of files) {
    if (!file.buffer?.length || file.size > maximumAttachmentSize) {
      return 'Each attachment must be smaller than 2 MB.'
    }
    if (!detectAttachmentType(file.buffer)) {
      return 'Attachments must be valid PDF, JPG, PNG, or WebP files.'
    }
  }
  return null
}

export function attachmentRecord(file, ticketId, customerId) {
  const contentType = detectAttachmentType(file.buffer)
  return {
    ticket: ticketId,
    customer: customerId,
    originalName: safeFileName(file.originalname),
    contentType,
    size: file.size,
    data: file.buffer,
  }
}

function findCustomerTicket(ticketId, customerId) {
  if (!mongoose.isValidObjectId(ticketId)) return null
  return Ticket.findOne({ _id: ticketId, customer: customerId })
}

function getCustomerTicketDetails(ticketId, customerId) {
  return Ticket.findOne({ _id: ticketId, customer: customerId })
    .populate({
      path: 'messages',
      populate: [
        { path: 'author', select: 'fullName role' },
        { path: 'attachments', select: 'originalName contentType size createdAt' },
      ],
    })
    .populate('assignedAgent', 'fullName')
    .populate('attachments', 'originalName contentType size createdAt')
    .lean()
}

export async function listCustomerTickets(req, res, next) {
  try {
    const tickets = await Ticket.find({ customer: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('-messages')
      .lean()
    return res.json({ tickets })
  } catch (error) {
    return next(error)
  }
}

export async function getCustomerTicket(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const ticket = await getCustomerTicketDetails(req.params.ticketId, req.user.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    return res.json({ ticket })
  } catch (error) {
    return next(error)
  }
}

export async function createCustomerTicket(req, res, next) {
  try {
    const { subject, description, category, priority } = req.body ?? {}
    const errors = getTicketErrors({ subject, description, category, priority })
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors })
    }
    const attachmentError = getAttachmentErrors(req.files)
    if (attachmentError) return res.status(400).json({ message: attachmentError })

    const ticketId = new mongoose.Types.ObjectId()
    let attachments = []
    try {
      if (req.files?.length) {
        attachments = await TicketAttachment.create(
          req.files.map((file) => attachmentRecord(file, ticketId, req.user.id)),
        )
      }
      const ticket = await Ticket.create({
        _id: ticketId,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        customer: req.user.id,
        status: 'pending',
        slaDueAt: getSlaDeadline(new Date(), priority),
        attachments: attachments.map(({ id }) => id),
      })
      try {
        await notifySupportOfNewTicket(req.app.get('io'), ticket, req.user.id)
      } catch (notificationError) {
        console.error(`Ticket ${ticket.id} was created, but its queue notification could not be saved.`, notificationError)
      }
      return res.status(201).json({ ticket })
    } catch (error) {
      if (attachments.length) {
        const cleanup = await TicketAttachment.deleteMany({ _id: { $in: attachments.map(({ id }) => id) } })
        if (cleanup.deletedCount !== attachments.length) {
          console.error(`Could not clean up every attachment after ticket creation failed (${ticketId}).`)
        }
      }
      return next(error)
    }
  } catch (error) {
    return next(error)
  }
}

export async function updateCustomerTicket(req, res, next) {
  try {
    const ticket = await findCustomerTicket(req.params.ticketId, req.user.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    if (!canCustomerEditTicket(ticket)) {
      return res.status(409).json({ message: 'This ticket can only be edited before support begins working on it.' })
    }

    const allowedKeys = ['subject', 'description', 'category', 'priority']
    const suppliedKeys = Object.keys(req.body ?? {})
    if (!suppliedKeys.length || suppliedKeys.some((key) => !allowedKeys.includes(key))) {
      return res.status(400).json({ message: 'Only subject, description, category, and priority can be updated.' })
    }

    const changes = Object.fromEntries(suppliedKeys.map((key) => [key, req.body[key]]))
    const errors = getTicketErrors({
      subject: changes.subject ?? ticket.subject,
      description: changes.description ?? ticket.description,
      category: changes.category ?? ticket.category,
      priority: changes.priority ?? ticket.priority,
    })
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors })
    }

    for (const key of suppliedKeys) {
      ticket[key] = typeof changes[key] === 'string' ? changes[key].trim() : changes[key]
    }
    if (suppliedKeys.includes('priority') && ticket.priority !== changes.priority) {
      ticket.slaDueAt = getSlaDeadline(ticket.createdAt, ticket.priority)
    }
    await ticket.save()
    return res.json({ ticket: await getCustomerTicketDetails(ticket.id, req.user.id) })
  } catch (error) {
    return next(error)
  }
}

export async function addCustomerMessage(req, res, next) {
  try {
    const ticket = await findCustomerTicket(req.params.ticketId, req.user.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    if (ticket.status === 'closed') return res.status(409).json({ message: 'This ticket is closed and can no longer receive messages.' })
    const messageError = getMessageError(req.body?.body)
    if (messageError) return res.status(400).json({ message: messageError, errors: { body: messageError } })

    const message = await appendTicketMessage(ticket, { author: req.user.id, body: req.body.body.trim() })
    if (!message) return res.status(409).json({ message: 'This ticket changed before the message could be saved. Refresh and try again.' })
    if (ticket.status === 'resolved') ticket.status = 'pending'
    try {
      await notifyTicketMessage(req.app.get('io'), ticket, req.user, req.user.role)
    } catch (notificationError) {
      console.error(`Message on ticket ${ticket.id} was saved, but its notification could not be saved.`, notificationError)
    }
    return res.status(201).json({ ticket: await getCustomerTicketDetails(ticket.id, req.user.id) })
  } catch (error) {
    return next(error)
  }
}

export async function closeCustomerTicket(req, res, next) {
  try {
    const ticket = await findCustomerTicket(req.params.ticketId, req.user.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    if (ticket.status === 'closed') return res.status(409).json({ message: 'This ticket is already closed.' })
    ticket.status = 'closed'
    await ticket.save()
    return res.json({ ticket: await getCustomerTicketDetails(ticket.id, req.user.id) })
  } catch (error) {
    return next(error)
  }
}

export async function deleteCustomerTicket(req, res, next) {
  try {
    const ticket = await findCustomerTicket(req.params.ticketId, req.user.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    if (!canCustomerDeleteTicket(ticket)) {
      return res.status(409).json({ message: 'Only an unassigned ticket with no replies can be deleted. Close it instead.' })
    }
    await ticket.deleteOne()
    const [attachments, messages] = await Promise.all([
      TicketAttachment.deleteMany({ ticket: ticket.id, customer: req.user.id }),
      Message.deleteMany({ ticket: ticket.id }),
    ])
    if (attachments.deletedCount !== ticket.attachments.length) {
      console.error(`Could not clean up every attachment after ticket ${ticket.id} was deleted.`)
    }
    if (messages.deletedCount !== ticket.messages.length) console.error(`Could not clean up every message after ticket ${ticket.id} was deleted.`)
    return res.json({ message: 'Ticket deleted.' })
  } catch (error) {
    return next(error)
  }
}

export async function addCustomerAttachments(req, res, next) {
  try {
    const ticket = await findCustomerTicket(req.params.ticketId, req.user.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    if (ticket.status === 'closed') return res.status(409).json({ message: 'Attachments cannot be added to a closed ticket.' })
    const files = req.files ?? []
    if (!files.length) return res.status(400).json({ message: 'Choose at least one attachment.' })
    if (ticket.attachments.length + files.length > maximumAttachmentCount) {
      return res.status(400).json({ message: 'A ticket can have no more than 3 attachments.' })
    }
    const attachmentError = getAttachmentErrors(files)
    if (attachmentError) return res.status(400).json({ message: attachmentError })

    const attachments = await TicketAttachment.create(
      files.map((file) => attachmentRecord(file, ticket.id, req.user.id)),
    )
    ticket.attachments.push(...attachments.map(({ id }) => id))
    await ticket.save()
    return res.status(201).json({ ticket: await getCustomerTicketDetails(ticket.id, req.user.id) })
  } catch (error) {
    return next(error)
  }
}

export async function downloadCustomerAttachment(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId) || !mongoose.isValidObjectId(req.params.attachmentId)) {
      return res.status(404).json({ message: 'Attachment not found.' })
    }
    const attachment = await TicketAttachment.findOne({
      _id: req.params.attachmentId,
      ticket: req.params.ticketId,
      customer: req.user.id,
    }).select('+data').lean()
    if (!attachment) return res.status(404).json({ message: 'Attachment not found.' })
    res.set({
      'Content-Type': attachment.contentType,
      'Content-Length': attachment.size,
      'Content-Disposition': `attachment; filename="${attachment.originalName.replace(/["\\]/g, '_')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    })
    return res.send(attachment.data)
  } catch (error) {
    return next(error)
  }
}
