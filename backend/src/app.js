import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import authRoutes from './routes/authRoutes.js'
import userRoutes from './routes/userRoutes.js'
import messageRoutes from './routes/messageRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import ticketRoutes from './routes/ticketRoutes.js'
import triageRoutes from './routes/triageRoutes.js'
import replyDraftRoutes from './routes/replyDraftRoutes.js'
import chatRoutes from './routes/chatRoutes.js'
import agentTicketRoutes from './routes/agentTicketRoutes.js'
import supervisorRoutes from './routes/supervisorRoutes.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import knowledgeRoutes from './routes/knowledgeRoutes.js'
import csatRoutes from './routes/csatRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import contactRoutes from './routes/contactRoutes.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { createTriageProvider } from './services/triageService.js'
import { createReplyDraftProvider } from './services/replyDraftService.js'
import { createKnowledgeRetrievalService } from './services/knowledgeRetrievalService.js'

export function createApp(config) {
  const app = express()
  app.locals.config = config
  app.locals.triageProvider = createTriageProvider(config)
  app.locals.replyDraftProvider = createReplyDraftProvider(config)
  app.locals.knowledgeRetrieval = createKnowledgeRetrievalService()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: config.clientUrl, credentials: true }))
  app.use(express.json({ limit: '20kb' }))
  app.use(cookieParser())

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many authentication attempts. Please wait and try again.' },
  })
  app.use('/api/auth/register', authRateLimit)
  app.use('/api/auth/login', authRateLimit)
  app.use('/api/contact', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many contact requests. Please wait and try again.' },
  }))
  app.use('/api/contact', contactRoutes)
  app.use('/api/auth', authRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/messages', messageRoutes)
  app.use('/api/ai', aiRoutes)
  app.use('/api/ai/triage', triageRoutes)
  app.use('/api/ai/replies', replyDraftRoutes)
  app.use('/api/chat', chatRoutes)
  app.use('/api/agents/tickets', agentTicketRoutes)
  app.use('/api/agent/tickets', agentTicketRoutes)
  app.use('/api/supervisor', supervisorRoutes)
  app.use('/api/analytics', analyticsRoutes)
  app.use('/api/knowledge', knowledgeRoutes)
  app.use('/api/csat', csatRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/notifications', notificationRoutes)
  app.use('/api/tickets', ticketRoutes)
  app.use('/api', notFound)
  app.use(errorHandler)
  return app
}
