import Notification from '../models/Notification.js'
import User from '../models/User.js'

const ticketNumber = (ticketId) => String(ticketId).slice(-6).toUpperCase()

export async function createNotifications({
  io,
  recipientIds = [],
  roles = [],
  excludeUserId,
  type,
  title,
  message,
  ticketId,
}) {
  const uniqueIds = [...new Set(recipientIds.filter(Boolean).map((recipient) => String(recipient._id || recipient.id || recipient)))]
  const clauses = []
  if (uniqueIds.length) clauses.push({ _id: { $in: uniqueIds } })
  if (roles.length) clauses.push({ role: { $in: roles }, isActive: true })
  if (!clauses.length) return []

  const recipients = await User.find({ $or: clauses, isActive: true })
    .select('_id')
    .lean()
  const filteredRecipients = recipients.filter((recipient) => String(recipient._id) !== String(excludeUserId || ''))
  if (!filteredRecipients.length) return []

  const documents = await Notification.insertMany(filteredRecipients.map(({ _id }) => ({
    recipient: _id,
    type,
    title,
    message,
    ticketId: ticketId || null,
  })))
  if (io) {
    for (const notification of documents) {
      const payload = {
        _id: String(notification._id),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        ticketId: notification.ticketId ? String(notification.ticketId) : null,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      }
      io.to(`user:${notification.recipient}`).emit('notification:new', payload)
    }
  }
  return documents
}

export function notifySupportOfNewTicket(io, ticket, actorId) {
  const id = ticket.id || ticket._id
  return createNotifications({
    io,
    roles: ['agent', 'supervisor', 'admin'],
    excludeUserId: actorId,
    type: 'ticket_assigned',
    title: 'New ticket in the support queue',
    message: `Ticket #${ticketNumber(id)} is ready for review.`,
    ticketId: id,
  })
}

export function notifyTicketAssignee(io, ticket, actorId, { title = 'Ticket assigned to you', type = 'ticket_assigned' } = {}) {
  if (!ticket.assignedAgent) return Promise.resolve([])
  const id = ticket.id || ticket._id
  return createNotifications({
    io,
    recipientIds: [ticket.assignedAgent],
    excludeUserId: actorId,
    type,
    title,
    message: `Ticket #${ticketNumber(id)} · ${ticket.subject}`,
    ticketId: id,
  })
}

export function notifyTicketCustomer(io, ticket, actorId, { type, title, message } = {}) {
  const id = ticket.id || ticket._id
  return createNotifications({
    io,
    recipientIds: [ticket.customer],
    excludeUserId: actorId,
    type,
    title,
    message: message || `Ticket #${ticketNumber(id)} · ${ticket.subject}`,
    ticketId: id,
  })
}

export async function notifyTicketMessage(io, ticket, author, authorRole) {
  const id = ticket.id || ticket._id
  const number = ticketNumber(id)
  if (authorRole === 'customer') {
    if (ticket.assignedAgent) {
      return notifyTicketAssignee(io, ticket, author.id, {
        type: 'customer_message',
        title: 'New customer message',
        message: `A customer replied on ticket #${number}.`,
      })
    }
    return createNotifications({
      io,
      roles: ['agent', 'supervisor', 'admin'],
      excludeUserId: author.id,
      type: 'customer_message',
      title: 'New customer message',
      message: `A customer replied on unassigned ticket #${number}.`,
      ticketId: id,
    })
  }
  return notifyTicketCustomer(io, ticket, author.id, {
    type: 'customer_message',
    title: 'New support message',
    message: `Your support team replied on ticket #${number}.`,
  })
}

export async function notifyTicketResolved(io, ticket, actorId) {
  return notifyTicketCustomer(io, ticket, actorId, {
    type: 'ticket_resolved',
    title: 'Your ticket was resolved',
    message: `Ticket #${ticketNumber(ticket.id || ticket._id)} has been resolved.`,
  })
}

export function notifyDraftReady(io, ticket, actorId) {
  const id = ticket.id || ticket._id
  const recipients = ticket.assignedAgent ? [ticket.assignedAgent] : []
  return createNotifications({
    io,
    recipientIds: recipients,
    roles: recipients.length ? [] : ['agent', 'supervisor', 'admin'],
    excludeUserId: actorId,
    type: 'ai_draft_ready',
    title: 'AI reply draft is ready',
    message: `A reply draft is ready for ticket #${ticketNumber(id)}.`,
    ticketId: id,
  })
}

export async function notifySlaWarning(io, ticket) {
  const id = ticket.id || ticket._id
  if (ticket.assignedAgent) {
    return notifyTicketAssignee(io, ticket, null, {
      type: 'sla_warning',
      title: 'SLA response deadline approaching',
      message: `Ticket #${ticketNumber(id)} is due within 15 minutes.`,
    })
  }
  return createNotifications({
    io,
    roles: ['agent', 'supervisor', 'admin'],
    type: 'sla_warning',
    title: 'Unassigned ticket nearing SLA',
    message: `Ticket #${ticketNumber(id)} is due within 15 minutes.`,
    ticketId: id,
  })
}
