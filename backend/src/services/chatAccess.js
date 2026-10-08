import mongoose from 'mongoose'
import Ticket from '../models/Ticket.js'

export const staffRoles = ['agent', 'supervisor', 'admin']

export function canAccessChatTicket(ticket, user) {
  if (!ticket || !user) return false
  if (user.role === 'customer') return String(ticket.customer) === String(user.id || user._id)
  return staffRoles.includes(user.role)
}

export async function findChatTicket(ticketId, user) {
  if (!mongoose.isValidObjectId(ticketId)) return null
  const ticket = await Ticket.findById(ticketId)
  return canAccessChatTicket(ticket, user) ? ticket : null
}
