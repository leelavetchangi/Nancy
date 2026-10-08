import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import User from './models/User.js'
import Ticket from './models/Ticket.js'
import Message from './models/Message.js'
import { canAccessChatTicket } from './services/chatAccess.js'
import { getMessageError } from './controllers/ticketController.js'
import { notifyTicketMessage } from './services/notificationService.js'
import { appendTicketMessage } from './services/messageService.js'

const ticketRoom = (id) => `ticket:${id}`
const userRoom = (id) => `user:${id}`
const roleRoom = (role) => `role:${role}`

function getSessionCookie(header = '') {
  const pair = header.split(';').map((part) => part.trim()).find((part) => part.startsWith('nexa_session='))
  if (!pair) return ''
  try {
    return decodeURIComponent(pair.slice('nexa_session='.length))
  } catch {
    return ''
  }
}

export async function authenticateSocket(socket, config, userModel = User) {
  const token = getSessionCookie(socket.handshake.headers.cookie || '')
  if (!token) throw new Error('Please sign in to use live chat.')
  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'nexa-api',
      audience: 'nexa-web',
    })
  } catch {
    throw new Error('Your session is invalid or expired. Please sign in again.')
  }
  if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
    throw new Error('Your session is invalid. Please sign in again.')
  }
  const user = await userModel.findById(payload.sub)
  if (!user || !user.isActive) throw new Error('Your session is no longer active. Please sign in again.')
  socket.data.user = user
}

export function createChatSocketServer(httpServer, config, options = {}) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    maxHttpBufferSize: 1e6,
    ...options,
  })

  io.use((socket, next) => {
    authenticateSocket(socket, config).then(() => next()).catch(next)
  })

  io.on('connection', (socket) => {
    const user = socket.data.user
    const userId = String(user.id)
    socket.join(userRoom(userId))
    socket.join(roleRoom(user.role))
    socket.data.ticketRooms = new Set()
    socket.on('chat:join', async (payload, acknowledge = () => {}) => {
      const ticketId = payload?.ticketId
      if (typeof ticketId !== 'string' || !mongoose.isValidObjectId(ticketId)) return acknowledge({ error: 'A valid ticket is required.' })
      try {
        const ticket = await Ticket.findById(ticketId).select('customer status')
        if (!canAccessChatTicket(ticket, user)) return acknowledge({ error: 'You do not have access to this conversation.' })
        const room = ticketRoom(ticketId)
        await socket.join(room)
        socket.data.ticketRooms.add(room)
        const participants = Array.from(io.sockets.adapter.rooms.get(room) || [])
          .map((socketId) => io.sockets.sockets.get(socketId)?.data.user)
          .filter(Boolean)
          .map((participant) => ({ id: String(participant.id), fullName: participant.fullName, role: participant.role }))
          .filter((participant, index, all) => all.findIndex((other) => other.id === participant.id) === index)
        acknowledge({ ok: true, participants })
        socket.to(room).emit('chat:participant-joined', {
          user: { id: userId, fullName: user.fullName, role: user.role },
        })
      } catch (error) {
        console.error('Could not join the live chat ticket room.', error)
        acknowledge({ error: 'Unable to join this conversation.' })
      }
    })

    socket.on('chat:leave', (payload) => {
      if (typeof payload?.ticketId !== 'string') return
      const room = ticketRoom(payload.ticketId)
      if (!socket.data.ticketRooms.has(room)) return
      socket.leave(room)
      socket.data.ticketRooms.delete(room)
      void io.in(userRoom(userId)).fetchSockets().then((sockets) => {
        const stillInConversation = sockets.some((connectedSocket) => connectedSocket.data.ticketRooms?.has(room))
        if (!stillInConversation) io.to(room).emit('chat:participant-left', { userId })
      })
    })

    socket.on('chat:send', async (payload, acknowledge = () => {}) => {
      const ticketId = payload?.ticketId
      const messageError = getMessageError(payload?.body)
      if (typeof ticketId !== 'string' || !mongoose.isValidObjectId(ticketId) || messageError) {
        return acknowledge({ error: messageError || 'A valid ticket is required.' })
      }
      const room = ticketRoom(ticketId)
      if (!socket.data.ticketRooms.has(room)) return acknowledge({ error: 'Join the conversation before sending a message.' })
      try {
        const ticket = await Ticket.findById(ticketId)
        if (!canAccessChatTicket(ticket, user)) return acknowledge({ error: 'You do not have access to this conversation.' })
        if (ticket.status === 'closed') return acknowledge({ error: 'This ticket is closed and cannot receive messages.' })
        const savedMessage = await appendTicketMessage(ticket, {
          author: user.id,
          body: payload.body.trim(),
        })
        if (!savedMessage) return acknowledge({ error: 'This ticket changed before the message could be saved. Refresh and try again.' })
        const messagePayload = { ticketId, message: savedMessage }
        io.to(room).emit('chat:message', messagePayload)
        for (const recipient of [ticket.customer, ticket.assignedAgent].filter(Boolean)) {
          if (String(recipient) !== userId) io.to(userRoom(String(recipient))).emit('chat:notification', messagePayload)
        }
        if (user.role === 'customer' && !ticket.assignedAgent) {
          for (const role of ['agent', 'supervisor', 'admin']) {
            io.to(roleRoom(role)).emit('chat:notification', messagePayload)
          }
        }
        try {
          await notifyTicketMessage(io, ticket, user, user.role)
        } catch (notificationError) {
          console.error(`Live chat message on ticket ${ticketId} was saved, but its notification could not be saved.`, notificationError)
        }
        acknowledge({ ok: true, message: savedMessage })
      } catch (error) {
        console.error('Could not persist a live chat message.', error)
        acknowledge({ error: 'Message could not be saved. Please try again.' })
      }
    })

    for (const event of ['chat:typing-start', 'chat:typing-stop']) {
      socket.on(event, (payload) => {
        if (typeof payload?.ticketId !== 'string') return
        const room = ticketRoom(payload.ticketId)
        if (!socket.data.ticketRooms.has(room)) return
        socket.to(room).emit('chat:typing', {
          ticketId: payload.ticketId,
          user: { id: userId, fullName: user.fullName },
          typing: event === 'chat:typing-start',
        })
      })
    }

    socket.on('chat:mark-read', async (payload, acknowledge = () => {}) => {
      const ticketId = payload?.ticketId
      if (typeof ticketId !== 'string' || !mongoose.isValidObjectId(ticketId) || !socket.data.ticketRooms.has(ticketRoom(ticketId))) {
        return acknowledge({ error: 'Join the conversation before marking messages as read.' })
      }
      try {
        const ticket = await Ticket.findById(ticketId).select('customer')
        if (!canAccessChatTicket(ticket, user)) return acknowledge({ error: 'You do not have access to this conversation.' })
        const readAt = new Date()
        await Message.updateMany(
          { ticket: ticketId, author: { $ne: user.id }, readAt: null },
          { $set: { readAt } },
        )
        io.to(ticketRoom(ticketId)).emit('chat:read', { ticketId, readerId: userId, readAt })
        acknowledge({ ok: true, readAt })
      } catch (error) {
        console.error('Could not update live chat read status.', error)
        acknowledge({ error: 'Read status could not be updated.' })
      }
    })

    socket.on('disconnect', () => {
      for (const room of socket.data.ticketRooms) {
        void io.in(userRoom(userId)).fetchSockets().then((sockets) => {
          const stillInConversation = sockets.some((connectedSocket) => connectedSocket.data.ticketRooms?.has(room))
          if (!stillInConversation) io.to(room).emit('chat:participant-left', { userId })
        })
      }
    })
  })

  return io
}
