import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'
import jwt from 'jsonwebtoken'
import { io as createSocketClient } from 'socket.io-client'
import { createApp } from '../app.js'
import { getRegistrationErrors } from './authController.js'
import { getCsatErrors } from './csatController.js'
import CSAT from '../models/CSAT.js'
import Message from '../models/Message.js'
import Notification from '../models/Notification.js'
import ContactMessage from '../models/ContactMessage.js'
import Ticket from '../models/Ticket.js'
import User from '../models/User.js'
import KnowledgeArticle from '../models/KnowledgeArticle.js'
import AuditLog from '../models/AuditLog.js'
import { getContactErrors } from './contactController.js'
import {
  getAdminTicketErrors,
  getAdminUserErrors,
  getWorkspaceSettingsErrors,
} from './adminController.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import { authenticateSocket, createChatSocketServer } from '../chatSocket.js'
import { canAccessChatTicket } from '../services/chatAccess.js'
import {
  canCustomerDeleteTicket,
  canCustomerEditTicket,
  getAttachmentErrors,
  getMessageError,
  getTicketErrors,
} from './ticketController.js'
import {
  applyReviewDecision,
  createTriageProvider,
  HttpTriageProvider,
  RulesBasedTriageProvider,
  triageConstants,
} from '../services/triageService.js'

let server
let chatIo
let baseUrl

before(async () => {
  const config = {
    clientUrl: 'http://localhost:5173',
    jwtSecret: 'test-secret-that-is-long-enough-for-unit-tests',
    nodeEnv: 'test',
  }
  const app = createApp(config)
  server = createServer(app)
  chatIo = createChatSocketServer(server, config)
  app.set('io', chatIo)
  server.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (chatIo) await new Promise((resolve) => chatIo.close(resolve))
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('registration rejects invalid fields with per-field validation errors', () => {
  const errors = getRegistrationErrors({
    fullName: 'A',
    email: 'not-an-email',
    mobileNumber: 'abc',
    password: 'password',
  })

  assert.deepEqual(Object.keys(errors).sort(), ['email', 'fullName', 'mobileNumber', 'password'])
})

test('registration accepts complete, strong customer account fields', () => {
  const errors = getRegistrationErrors({
    fullName: 'Nexa Customer',
    email: 'customer@example.com',
    mobileNumber: '+1 (555) 010-2020',
    password: 'StrongPass9!',
  })

  assert.deepEqual(errors, {})
})

test('registration rejects passwords that exceed bcrypt input length', () => {
  const errors = getRegistrationErrors({
    fullName: 'Nexa Customer',
    email: 'customer@example.com',
    mobileNumber: '+1 (555) 010-2020',
    password: `${'StrongPass9!'.repeat(7)}x`,
  })

  assert.equal(errors.password, 'Use 8–72 bytes with upper- and lowercase letters, a number, and a symbol.')
})

test('health endpoint reports API readiness without exposing configuration', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('login rejects missing credentials with a client error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@example.com' }),
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { message: 'Enter a valid email and password.' })
})

test('protected auth profile rejects requests without a session cookie', async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { message: 'Please sign in to continue.' })
})

test('session bootstrap returns an empty session without a cookie', async () => {
  const response = await fetch(`${baseUrl}/api/auth/session`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { user: null })
})

test('session bootstrap clears invalid and expired cookies without an authentication error', async () => {
  const expiredToken = jwt.sign(
    { sub: '507f1f77bcf86cd799439011' },
    'test-secret-that-is-long-enough-for-unit-tests',
    { expiresIn: -1, issuer: 'nexa-api', audience: 'nexa-web' },
  )

  for (const token of ['not-a-jwt', expiredToken]) {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: `nexa_session=${token}` },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { user: null })
    assert.match(response.headers.get('set-cookie') || '', /nexa_session=;/)
  }
})

test('JWT authentication rejects tokens not issued for the NEXA API', async () => {
  const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, 'test-secret-that-is-long-enough-for-unit-tests', {
    expiresIn: '1h',
    issuer: 'other-api',
    audience: 'nexa-web',
  })
  const request = {
    cookies: { nexa_session: token },
    app: { locals: { config: { jwtSecret: 'test-secret-that-is-long-enough-for-unit-tests' } } },
  }
  const response = {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
  let continued = false

  await requireAuth(request, response, () => { continued = true })

  assert.equal(continued, false)
  assert.equal(response.statusCode, 401)
  assert.equal(response.body.message, 'Your session is invalid. Please sign in again.')
})

test('JWT authentication reports expired sessions distinctly', async () => {
  const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, 'test-secret-that-is-long-enough-for-unit-tests', {
    expiresIn: '-1s',
    issuer: 'nexa-api',
    audience: 'nexa-web',
  })
  const request = {
    cookies: { nexa_session: token },
    app: { locals: { config: { jwtSecret: 'test-secret-that-is-long-enough-for-unit-tests' } } },
  }
  const response = {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }

  await requireAuth(request, response, () => assert.fail('Expired JWT must not authenticate'))

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.body, { message: 'Your session has expired. Please sign in again.' })
})

test('role authorization rejects users whose database role does not match', () => {
  const response = {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
  let continued = false

  requireRole('admin')({ user: { role: 'customer' } }, response, () => { continued = true })

  assert.equal(continued, false)
  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { message: 'You do not have permission to access this resource.' })
})

test('ticket validation accepts valid customer ticket fields', () => {
  assert.deepEqual(getTicketErrors({
    subject: 'Cannot access my account',
    description: 'The reset link says it has expired even though I requested it moments ago.',
    category: 'account',
    priority: 'high',
  }), {})
})

test('ticket validation rejects incomplete or invalid fields', () => {
  const errors = getTicketErrors({
    subject: 'Hi',
    description: '',
    category: 'other<script>',
    priority: 'urgent',
  })
  assert.deepEqual(Object.keys(errors).sort(), ['category', 'description', 'priority', 'subject'])
})

test('ticket message validation requires a non-empty message up to 2,000 characters', () => {
  assert.equal(getMessageError('  '), 'Enter a message of up to 2,000 characters.')
  assert.equal(getMessageError('Support update'), null)
  assert.equal(getMessageError('x'.repeat(2001)), 'Enter a message of up to 2,000 characters.')
})

test('CSAT validation only accepts integer ratings from one to five and bounded feedback', () => {
  assert.deepEqual(getCsatErrors({ rating: 5, feedback: 'Helpful response.' }), {})
  assert.deepEqual(getCsatErrors({ rating: 5.5 }), { rating: 'Choose a satisfaction rating from 1 to 5.' })
  assert.deepEqual(getCsatErrors({ rating: 0 }), { rating: 'Choose a satisfaction rating from 1 to 5.' })
  assert.deepEqual(getCsatErrors({ rating: 4, feedback: 'x'.repeat(1001) }), { feedback: 'Feedback must be 1,000 characters or fewer.' })
})

test('CSAT survey document stores ticket, user, rating, feedback, and timestamps', () => {
  const survey = new CSAT({
    ticketId: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439012',
    rating: 5,
    feedback: 'Support was helpful.',
  })

  assert.equal(survey.validateSync(), undefined)
  assert.equal(survey.ticketId.toString(), '507f1f77bcf86cd799439011')
  assert.equal(survey.userId.toString(), '507f1f77bcf86cd799439012')
  assert.equal(survey.rating, 5)
  assert.equal(survey.feedback, 'Support was helpful.')
  assert.equal(survey.schema.options.collection, 'csat_surveys')
  assert.equal(survey.schema.options.timestamps, true)
})

test('support models use timestamped documents and explicit MongoDB relationships', () => {
  const message = new Message({
    ticket: '507f1f77bcf86cd799439011',
    author: '507f1f77bcf86cd799439012',
    body: 'I can help with this request.',
  })

  assert.equal(message.validateSync(), undefined)
  assert.equal(Message.schema.path('ticket').options.ref, 'Ticket')
  assert.equal(Message.schema.path('author').options.ref, 'User')
  assert.equal(Message.schema.path('attachments').caster.options.ref, 'TicketAttachment')
  assert.equal(Ticket.schema.path('customer').options.ref, 'User')
  assert.equal(Ticket.schema.path('assignedAgent').options.ref, 'User')
  assert.equal(Ticket.schema.path('messages').caster.options.ref, 'Message')
  assert.equal(User.schema.options.timestamps, true)
  assert.equal(Ticket.schema.options.timestamps, true)
  assert.equal(KnowledgeArticle.schema.options.timestamps, true)
  assert.equal(Notification.schema.options.timestamps, true)
  assert.equal(AuditLog.schema.options.timestamps, true)
  assert.equal(ContactMessage.schema.options.timestamps, true)
  assert.equal(AuditLog.schema.options.collection, 'adminauditlogs')
})

test('admin user updates only allow valid roles and account state', () => {
  assert.deepEqual(getAdminUserErrors({ role: 'agent', isActive: false }), {})
  assert.equal(getAdminUserErrors({ role: 'owner' }).role, 'Choose a supported workspace role.')
  assert.equal(getAdminUserErrors({ isActive: 'false' }).isActive, 'Account status must be active or inactive.')
  assert.ok(getAdminUserErrors({ role: 'admin', passwordHash: 'plaintext' }).request)
})

test('admin ticket updates validate status, priority, and assignment fields', () => {
  assert.deepEqual(getAdminTicketErrors({ status: 'resolved', priority: 'high', assignedAgent: null }), {})
  assert.equal(getAdminTicketErrors({ status: 'waiting' }).status, 'Choose a supported ticket status.')
  assert.equal(getAdminTicketErrors({ priority: 'urgent' }).priority, 'Choose a supported priority.')
  assert.ok(getAdminTicketErrors({ assignedAgent: 'not-an-object-id' }).assignedAgent)
})

test('workspace settings validate bounded identity and email fields', () => {
  assert.deepEqual(getWorkspaceSettingsErrors({ workspaceName: 'NEXA Desk', supportEmail: 'help@example.com' }), {})
  assert.ok(getWorkspaceSettingsErrors({ workspaceName: 'x' }).workspaceName)
  assert.ok(getWorkspaceSettingsErrors({ supportEmail: 'invalid' }).supportEmail)
  assert.ok(getWorkspaceSettingsErrors({ jwtSecret: 'do-not-allow' }).request)
})

test('notification records require a recipient and supported notification type', () => {
  const notification = new Notification({
    recipient: '507f1f77bcf86cd799439012',
    type: 'customer_message',
    title: 'New message',
    message: 'A customer replied.',
    ticketId: '507f1f77bcf86cd799439011',
  })
  assert.equal(notification.validateSync(), undefined)
  assert.equal(notification.readAt, null)
  assert.equal(notification.recipient.toString(), '507f1f77bcf86cd799439012')

  const invalid = new Notification({
    recipient: '507f1f77bcf86cd799439012',
    type: 'unknown',
    title: 'Unexpected',
    message: 'Unsupported type.',
  })
  assert.equal(invalid.validateSync().errors.type.kind, 'enum')
})

test('contact form validation requires a bounded name, valid email, and useful message', () => {
  assert.deepEqual(getContactErrors({
    name: 'Nexa Visitor',
    email: 'visitor@example.com',
    message: 'I would like to learn more about NEXA.',
    company: '',
  }), {})
  assert.ok(getContactErrors({ name: 'A', email: 'bad', message: 'Hi' }).name)
  assert.ok(getContactErrors({ name: 'Visitor', email: 'bad', message: 'A message that is long enough.' }).email)
  assert.ok(getContactErrors({ name: 'Visitor', email: 'visitor@example.com', message: 'short' }).message)
  assert.ok(getContactErrors({ name: 'Visitor', email: 'visitor@example.com', message: 'x'.repeat(4001) }).message)
  assert.ok(getContactErrors({ name: 'Visitor', email: 'visitor@example.com', message: 'A valid contact message.', role: 'admin' }).request)
})

test('contact messages store normalized email and default new status', () => {
  const message = new ContactMessage({
    name: '  Nexa Visitor  ',
    email: ' VISITOR@EXAMPLE.COM ',
    message: '  Please contact me about NEXA.  ',
  })
  assert.equal(message.validateSync(), undefined)
  assert.equal(message.name, 'Nexa Visitor')
  assert.equal(message.email, 'visitor@example.com')
  assert.equal(message.message, 'Please contact me about NEXA.')
  assert.equal(message.status, 'new')
})

test('customers can only edit or delete pending, unassigned tickets without replies', () => {
  const pendingTicket = { status: 'pending', assignedAgent: null, messages: [] }
  assert.equal(canCustomerEditTicket(pendingTicket), true)
  assert.equal(canCustomerDeleteTicket(pendingTicket), true)
  assert.equal(canCustomerEditTicket({ ...pendingTicket, status: 'assigned_to_agent' }), false)
  assert.equal(canCustomerDeleteTicket({ ...pendingTicket, assignedAgent: 'agent-id' }), false)
  assert.equal(canCustomerEditTicket({ ...pendingTicket, messages: [{ body: 'Support replied' }] }), false)
  assert.equal(canCustomerDeleteTicket({ ...pendingTicket, status: 'closed' }), false)
})

test('chat access only exposes a ticket to its customer and trusted support roles', () => {
  const ticket = { customer: 'customer-1' }
  assert.equal(canAccessChatTicket(ticket, { id: 'customer-1', role: 'customer' }), true)
  assert.equal(canAccessChatTicket(ticket, { id: 'customer-2', role: 'customer' }), false)
  assert.equal(canAccessChatTicket(ticket, { id: 'agent-1', role: 'agent' }), true)
  assert.equal(canAccessChatTicket(ticket, { id: 'unknown-1', role: 'other' }), false)
  assert.equal(canAccessChatTicket(null, { id: 'agent-1', role: 'agent' }), false)
})

test('Socket.IO authentication rejects requests without the HttpOnly session cookie', async () => {
  await assert.rejects(
    authenticateSocket({ handshake: { headers: {} } }, { jwtSecret: 'long-enough-test-secret' }),
    { message: 'Please sign in to use live chat.' },
  )
})

test('Socket.IO authenticates the NEXA session cookie against the current user record', async () => {
  const config = { jwtSecret: 'test-secret-that-is-long-enough-for-unit-tests' }
  const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, config.jwtSecret, {
    expiresIn: '1h',
    issuer: 'nexa-api',
    audience: 'nexa-web',
  })
  const user = { id: '507f1f77bcf86cd799439011', isActive: true, role: 'customer' }
  const socket = {
    handshake: { headers: { cookie: `other=value; nexa_session=${token}` } },
    data: {},
  }
  await authenticateSocket(socket, config, { findById: async (id) => id === user.id ? user : null })
  assert.equal(socket.data.user, user)
})

test('Socket.IO rejects an unauthenticated handshake', async () => {
  const client = createSocketClient(baseUrl, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
  })
  try {
    const error = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Unauthenticated socket was not rejected.')), 3000)
      client.once('connect_error', (connectError) => {
        clearTimeout(timeout)
        resolve(connectError)
      })
      client.once('connect', () => {
        clearTimeout(timeout)
        reject(new Error('Unauthenticated socket unexpectedly connected.'))
      })
      client.connect()
    })
    assert.match(error.message, /sign in/)
  } finally {
    client.disconnect()
  }
})

test('ticket attachments are limited to three small files with valid PDF signatures', () => {
  const validPdf = { originalname: 'report.pdf', mimetype: 'application/pdf', size: 8, buffer: Buffer.from('%PDF-1.7') }
  const invalidFile = { originalname: 'report.pdf', mimetype: 'application/pdf', size: 8, buffer: Buffer.from('not a pdf') }
  const oversizedFile = { originalname: 'large.pdf', mimetype: 'application/pdf', size: 2 * 1024 * 1024 + 1, buffer: Buffer.from('%PDF-1.7') }

  assert.equal(getAttachmentErrors([validPdf]), null)
  assert.equal(getAttachmentErrors([invalidFile]), 'Attachments must be valid PDF, JPG, PNG, or WebP files.')
  assert.equal(getAttachmentErrors([oversizedFile]), 'Each attachment must be smaller than 2 MB.')
  assert.equal(getAttachmentErrors([validPdf, validPdf, validPdf, validPdf]), 'Attach no more than 3 files.')
  const validWebm = { originalname: 'voice.webm', mimetype: 'audio/webm', size: 4, buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]) }
  assert.equal(getAttachmentErrors([validWebm]), null)
})

test('ticket API rejects unauthenticated ticket listing', async () => {
  const response = await fetch(`${baseUrl}/api/tickets`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { message: 'Please sign in to continue.' })
})

test('canonical user, message, agent, and supervisor route groups require authentication', async () => {
  const requests = [
    ['GET', '/api/users/me'],
    ['GET', '/api/messages/tickets/507f1f77bcf86cd799439011'],
    ['POST', '/api/messages/tickets/507f1f77bcf86cd799439011'],
    ['GET', '/api/agents/tickets'],
    ['GET', '/api/supervisor/analytics'],
  ]

  for (const [method, path] of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Please help with my ticket.' }) } : {}),
    })
    assert.equal(response.status, 401, `${method} ${path} should require authentication`)
  }
})

test('triage rules provider is explicitly identified as non-AI and produces traceable signals', async () => {
  const provider = createTriageProvider({})
  assert.ok(provider instanceof RulesBasedTriageProvider)
  assert.equal(provider.provider, 'rules')
  const result = await provider.analyze({
    subject: 'Payment was charged twice',
    description: 'I need a refund for an unexpected billing charge. I am frustrated.',
  })
  assert.equal(result.provider, 'rules')
  assert.equal(result.category, 'billing')
  assert.equal(result.sentiment, 'frustrated')
  assert.match(result.rationale, /local keyword-rule preview, not an AI analysis/)
  assert.equal(applyReviewDecision(result).reviewRequired, true)
})

test('high-confidence AI result recommends a team without auto-assigning and low confidence requires review', () => {
  const base = {
    provider: 'ai',
    category: 'technical',
    priority: 'high',
    sentiment: 'frustrated',
    recommendedTeam: 'Technical Support',
    rationale: 'Technical error and urgency detected.',
  }
  assert.equal(applyReviewDecision({ ...base, confidence: 0.94 }).reviewRequired, false)
  assert.equal(applyReviewDecision({ ...base, confidence: 0.79 }).reviewRequired, true)
  assert.equal(triageConstants.minimumConfidence, 0.8)
})

test('remote triage provider validates and labels its configured response', async () => {
  const provider = new HttpTriageProvider({
    url: 'https://triage.example.test/analyze',
    fetchImplementation: async (_url, options) => {
      assert.equal(options.method, 'POST')
      assert.equal(JSON.parse(options.body).ticket.subject, 'Cannot sign in')
      const body = JSON.stringify({
        category: 'account',
        priority: 'high',
        sentiment: 'frustrated',
        confidence: 0.91,
        recommendedTeam: 'Account Support',
        rationale: 'Sign-in failure and frustration detected.',
      })
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
    },
  })
  const result = await provider.analyze({
    subject: 'Cannot sign in',
    description: 'The account sign in page is failing.',
    category: 'other',
    priority: 'medium',
  })
  assert.equal(result.provider, 'ai')
  assert.equal(result.confidence, 0.91)
})

test('remote triage provider rejects invalid response contracts without a rules fallback', async () => {
  const provider = new HttpTriageProvider({
    url: 'https://triage.example.test/analyze',
    fetchImplementation: async () => new Response(JSON.stringify({
      category: 'unknown',
      priority: 'high',
      sentiment: 'frustrated',
      confidence: 0.91,
      recommendedTeam: 'Technical Support',
      rationale: 'Result',
    }), { status: 200 }),
  })
  await assert.rejects(
    provider.analyze({ subject: 'Question', description: 'Details' }),
    { name: 'TriageProviderError', message: 'The triage provider returned fields outside the supported contract.' },
  )
})

test('triage API rejects unauthenticated queue access', async () => {
  const response = await fetch(`${baseUrl}/api/ai/triage/tickets`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { message: 'Please sign in to continue.' })
})

test('supervisor analytics API rejects unauthenticated access', async () => {
  const response = await fetch(`${baseUrl}/api/analytics`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { message: 'Please sign in to continue.' })
})

test('knowledge base APIs require a signed-in session', async () => {
  const requests = [
    ['GET', '/api/knowledge/popular'],
    ['GET', '/api/knowledge/search?q=account'],
    ['GET', '/api/knowledge/articles/507f1f77bcf86cd799439011'],
    ['POST', '/api/knowledge/articles'],
  ]
  for (const [method, path] of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    })
    assert.equal(response.status, 401, `${method} ${path} must require authentication`)
  }
})

test('CSAT survey APIs require an authenticated customer', async () => {
  const requests = [
    ['GET', '/api/csat'],
    ['POST', '/api/csat'],
  ]
  for (const [method, path] of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    })
    assert.equal(response.status, 401)
  }
})

test('admin management APIs require an authenticated administrator', async () => {
  const requests = [
    ['GET', '/api/admin/overview'],
    ['GET', '/api/admin/users'],
    ['PATCH', '/api/admin/users/507f1f77bcf86cd799439011'],
    ['GET', '/api/admin/tickets'],
    ['PATCH', '/api/admin/tickets/507f1f77bcf86cd799439011'],
    ['GET', '/api/admin/settings'],
    ['PATCH', '/api/admin/settings'],
    ['GET', '/api/admin/audit-logs'],
    ['GET', '/api/admin/permissions'],
  ]
  for (const [method, path] of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'PATCH' ? '{}' : undefined,
    })
    assert.equal(response.status, 401, `${method} ${path} must require authentication`)
  }
})

test('notification listing and read APIs require an authenticated session', async () => {
  const requests = [
    ['GET', '/api/notifications'],
    ['PATCH', '/api/notifications/read-all'],
    ['PATCH', '/api/notifications/507f1f77bcf86cd799439011/read'],
  ]
  for (const [method, path] of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'PATCH' ? '{}' : undefined,
    })
    assert.equal(response.status, 401, `${method} ${path} must require authentication`)
  }
})

test('contact API validates submissions before attempting MongoDB storage', async () => {
  const response = await fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', email: 'bad', message: 'short' }),
  })
  assert.equal(response.status, 400)
  const body = await response.json()
  assert.equal(body.message, 'Please correct the contact form.')
  assert.deepEqual(Object.keys(body.errors).sort(), ['email', 'message', 'name'])
})

test('reply drafting and approval APIs reject unauthenticated access', async () => {
  const ticketId = '507f1f77bcf86cd799439011'
  const requests = [
    ['GET', '/api/ai/replies/tickets'],
    ['POST', `/api/ai/replies/tickets/${ticketId}/generate`],
    ['PUT', `/api/ai/replies/tickets/${ticketId}/draft`],
    ['POST', `/api/ai/replies/tickets/${ticketId}/approve`],
    ['POST', `/api/ai/replies/tickets/${ticketId}/escalate`],
  ]

  for (const [method, path] of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    })
    assert.equal(response.status, 401, `${method} ${path} must require authentication`)
    assert.deepEqual(await response.json(), { message: 'Please sign in to continue.' })
  }
})

test('live chat APIs reject unauthenticated ticket access', async () => {
  const requests = [
    ['GET', '/api/chat/tickets'],
    ['GET', '/api/chat/tickets/507f1f77bcf86cd799439011'],
    ['POST', '/api/chat/tickets/507f1f77bcf86cd799439011/attachments'],
    ['GET', '/api/chat/tickets/507f1f77bcf86cd799439011/attachments/507f1f77bcf86cd799439012'],
  ]
  for (const [method, path] of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    })
    assert.equal(response.status, 401, `${method} ${path} must require authentication`)
  }
})

test('ticket API rejects unauthenticated mutations before parsing uploads', async () => {
  const response = await fetch(`${baseUrl}/api/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'Test request', description: 'An unauthenticated ticket', category: 'other', priority: 'low' }),
  })
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { message: 'Please sign in to continue.' })
})

test('ticket read, update, message, close, attachment, and delete APIs all require authentication', async () => {
  const requests = [
    ['GET', '/api/tickets/507f1f77bcf86cd799439011'],
    ['PUT', '/api/tickets/507f1f77bcf86cd799439011'],
    ['POST', '/api/tickets/507f1f77bcf86cd799439011/messages'],
    ['POST', '/api/tickets/507f1f77bcf86cd799439011/attachments'],
    ['POST', '/api/tickets/507f1f77bcf86cd799439011/close'],
    ['GET', '/api/tickets/507f1f77bcf86cd799439011/attachments/507f1f77bcf86cd799439012'],
    ['DELETE', '/api/tickets/507f1f77bcf86cd799439011'],
  ]

  for (const [method, path] of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
    })
    assert.equal(response.status, 401, `${method} ${path} must be protected`)
  }
})

test('unknown API routes return a JSON not-found response', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`)
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { message: 'The requested API route was not found.' })
})
