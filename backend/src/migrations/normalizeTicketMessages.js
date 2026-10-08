import 'dotenv/config'
import mongoose from 'mongoose'

const mongoUri = process.env.MONGO_URI?.trim()
if (!mongoUri) throw new Error('MONGO_URI is required to migrate embedded ticket messages.')

await mongoose.connect(mongoUri)

try {
  const tickets = mongoose.connection.collection('tickets')
  const messages = mongoose.connection.collection('messages')
  const cursor = tickets.find({ 'messages.0': { $type: 'object' } })
  let migratedTickets = 0
  let migratedMessages = 0

  for await (const ticket of cursor) {
    const embeddedMessages = ticket.messages
    if (!embeddedMessages.every((message) => message?._id && message.author && message.body)) {
      throw new Error(`Ticket ${ticket._id} contains an invalid legacy message; this ticket was not changed.`)
    }

    await messages.bulkWrite(
      embeddedMessages.map((message) => ({
        updateOne: {
          filter: { _id: message._id },
          update: {
            $setOnInsert: {
              _id: message._id,
              ticket: ticket._id,
              author: message.author,
              body: message.body,
              attachments: message.attachments || [],
              readAt: message.readAt || null,
              createdAt: message.createdAt || ticket.createdAt,
              updatedAt: message.updatedAt || message.createdAt || ticket.createdAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: true },
    )

    const result = await tickets.updateOne(
      { _id: ticket._id, 'messages.0': { $type: 'object' } },
      { $set: { messages: embeddedMessages.map((message) => message._id) } },
    )
    if (result.modifiedCount === 1) {
      migratedTickets += 1
      migratedMessages += embeddedMessages.length
    }
  }

  console.info(`Normalized ${migratedMessages} messages across ${migratedTickets} tickets.`)
} finally {
  await mongoose.disconnect()
}
