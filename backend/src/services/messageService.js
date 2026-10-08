import Message from '../models/Message.js'
import Ticket from '../models/Ticket.js'

const messagePopulation = [
  { path: 'author', select: 'fullName role' },
  { path: 'attachments', select: 'originalName contentType size createdAt' },
]

export async function appendTicketMessage(ticket, input) {
  if (ticket.status === 'closed') return null
  const message = await Message.create({
    ticket: ticket.id || ticket._id,
    author: input.author,
    body: input.body,
    attachments: input.attachments || [],
    readAt: input.readAt || null,
  })
  const update = { $push: { messages: message.id } }
  if (ticket.status === 'resolved') update.$set = { status: 'pending' }
  let result
  try {
    result = await Ticket.updateOne(
      { _id: ticket.id || ticket._id, status: ticket.status },
      update,
      { runValidators: true },
    )
  } catch (error) {
    const cleanup = await Message.deleteOne({ _id: message.id })
    if (cleanup.deletedCount !== 1) console.error(`Could not clean up message ${message.id} after ticket update failed.`)
    throw error
  }
  if (result.modifiedCount !== 1) {
    const cleanup = await Message.deleteOne({ _id: message.id })
    if (cleanup.deletedCount !== 1) console.error(`Could not clean up message ${message.id} after the ticket changed.`)
    return null
  }
  return Message.findById(message.id).populate(messagePopulation).lean()
}
