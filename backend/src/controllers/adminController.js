import mongoose from 'mongoose'
import AuditLog from '../models/AuditLog.js'
import KnowledgeArticle from '../models/KnowledgeArticle.js'
import Ticket from '../models/Ticket.js'
import User from '../models/User.js'
import WorkspaceSettings from '../models/WorkspaceSettings.js'
import { notifyTicketAssignee, notifyTicketCustomer, notifyTicketResolved } from '../services/notificationService.js'

const roles = ['customer', 'agent', 'supervisor', 'admin']
const ticketStatuses = ['pending', 'ai_processing', 'assigned_to_agent', 'resolved', 'escalated', 'closed']
const ticketPriorities = ['low', 'medium', 'high', 'critical']
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const adminPermissions = [
  { role: 'customer', permissions: ['Create and manage own tickets', 'Use live chat', 'Search support knowledge'] },
  { role: 'agent', permissions: ['Work assigned tickets', 'Use AI triage and draft assistance', 'Use live chat'] },
  { role: 'supervisor', permissions: ['Review all support queues', 'View analytics', 'Manage escalations'] },
  { role: 'admin', permissions: ['Manage users and tickets', 'Publish knowledge articles', 'View analytics and audit history', 'Manage workspace settings'] },
]

export function getAdminUserErrors(input = {}) {
  const errors = {}
  if (input.role !== undefined && !roles.includes(input.role)) errors.role = 'Choose a supported workspace role.'
  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') errors.isActive = 'Account status must be active or inactive.'
  if (Object.keys(input).some((key) => !['role', 'isActive'].includes(key))) errors.request = 'Only role and isActive can be updated.'
  if (!Object.keys(input).length) errors.request = 'Provide a role or account status to update.'
  return errors
}

export function getAdminTicketErrors(input = {}) {
  const errors = {}
  if (input.status !== undefined && !ticketStatuses.includes(input.status)) errors.status = 'Choose a supported ticket status.'
  if (input.priority !== undefined && !ticketPriorities.includes(input.priority)) errors.priority = 'Choose a supported priority.'
  if (input.assignedAgent !== undefined && input.assignedAgent !== null
    && (typeof input.assignedAgent !== 'string' || !mongoose.isValidObjectId(input.assignedAgent))) {
    errors.assignedAgent = 'Choose a valid support agent or leave the ticket unassigned.'
  }
  if (Object.keys(input).some((key) => !['status', 'priority', 'assignedAgent'].includes(key))) errors.request = 'Only status, priority, and assignedAgent can be updated.'
  if (!Object.keys(input).length) errors.request = 'Provide a ticket field to update.'
  return errors
}

export function getWorkspaceSettingsErrors(input = {}) {
  const errors = {}
  if (Object.keys(input).some((key) => !['workspaceName', 'supportEmail'].includes(key))) errors.request = 'Only workspaceName and supportEmail can be updated.'
  if (input.workspaceName !== undefined && (typeof input.workspaceName !== 'string' || input.workspaceName.trim().length < 2 || input.workspaceName.trim().length > 80)) {
    errors.workspaceName = 'Enter a workspace name from 2 to 80 characters.'
  }
  if (input.supportEmail !== undefined && (typeof input.supportEmail !== 'string' || input.supportEmail.trim().length > 254 || !emailPattern.test(input.supportEmail.trim()))) {
    errors.supportEmail = 'Enter a valid support email address.'
  }
  if (!Object.keys(input).length) errors.request = 'Provide a workspace setting to update.'
  return errors
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function writeAudit(req, action, targetType, targetId, summary) {
  await AuditLog.create({ actor: req.user.id, action, targetType, targetId: String(targetId), summary })
}

export async function getAdminOverview(req, res, next) {
  try {
    const [users, tickets, articles, latestActivity] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } }]),
      Ticket.aggregate([{ $group: { _id: '$status', total: { $sum: 1 } } }]),
      KnowledgeArticle.countDocuments(),
      AuditLog.find().sort({ createdAt: -1 }).limit(6).populate('actor', 'fullName role').lean(),
    ])
    return res.json({
      users: users.reduce((total, row) => total + row.total, 0),
      activeUsers: users.reduce((total, row) => total + row.active, 0),
      usersByRole: users,
      tickets: tickets.reduce((total, row) => total + row.total, 0),
      ticketsByStatus: tickets,
      articles,
      latestActivity,
      aiProviders: {
        triage: req.app.locals.triageProvider.provider === 'ai' ? 'connected' : 'rules',
        replyDraft: req.app.locals.replyDraftProvider.provider === 'ai' ? 'connected' : 'not_configured',
        knowledgeAnswers: req.app.locals.knowledgeRetrieval.answerProvider === 'unconfigured' ? 'not_configured' : 'connected',
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminUsers(req, res, next) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : ''
    const filter = search
      ? { $or: [{ fullName: { $regex: escapeRegExp(search), $options: 'i' } }, { email: { $regex: escapeRegExp(search), $options: 'i' } }] }
      : {}
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(300)
      .select('fullName email mobileNumber role isActive createdAt updatedAt').lean()
    return res.json({ users })
  } catch (error) {
    return next(error)
  }
}

export async function updateAdminUser(req, res, next) {
  try {
    const errors = getAdminUserErrors(req.body || {})
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please correct the user update.', errors })
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: 'User not found.' })
    const user = await User.findById(req.params.userId)
    if (!user) return res.status(404).json({ message: 'User not found.' })
    const updates = req.body
    if (user.id === req.user.id && ((updates.role && updates.role !== 'admin') || updates.isActive === false)) {
      return res.status(409).json({ message: 'You cannot remove your own administrator access.' })
    }
    const isRemovingAdmin = user.role === 'admin' && user.isActive
      && ((updates.role !== undefined && updates.role !== 'admin') || updates.isActive === false)
    if (isRemovingAdmin) {
      const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true })
      if (activeAdmins <= 1) return res.status(409).json({ message: 'The last active administrator cannot be demoted or deactivated.' })
    }
    const changes = []
    for (const field of ['role', 'isActive']) {
      if (updates[field] !== undefined && user[field] !== updates[field]) {
        changes.push(`${field} changed from ${user[field]} to ${updates[field]}`)
        user[field] = updates[field]
      }
    }
    if (!changes.length) return res.json({ user: user.toJSON() })
    await user.save()
    await writeAudit(req, 'user.updated', 'user', user.id, `${user.fullName}: ${changes.join('; ')}`)
    return res.json({ user: { id: user.id, fullName: user.fullName, email: user.email, mobileNumber: user.mobileNumber, role: user.role, isActive: user.isActive, createdAt: user.createdAt } })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminTickets(req, res, next) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : ''
    const filter = search
      ? { $or: [{ subject: { $regex: escapeRegExp(search), $options: 'i' } }, { description: { $regex: escapeRegExp(search), $options: 'i' } }] }
      : {}
    const tickets = await Ticket.find(filter).sort({ updatedAt: -1 }).limit(300)
      .select('subject category priority status createdAt updatedAt customer assignedAgent')
      .populate('customer', 'fullName email')
      .populate('assignedAgent', 'fullName role')
      .lean()
    const agents = await User.find({ role: { $in: ['agent', 'supervisor', 'admin'] }, isActive: true })
      .select('fullName role').sort({ fullName: 1 }).lean()
    return res.json({ tickets, agents })
  } catch (error) {
    return next(error)
  }
}

export async function updateAdminTicket(req, res, next) {
  try {
    const errors = getAdminTicketErrors(req.body || {})
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please correct the ticket update.', errors })
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(404).json({ message: 'Ticket not found.' })
    const ticket = await Ticket.findById(req.params.ticketId)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' })
    const previousStatus = ticket.status
    const previousAssignee = ticket.assignedAgent?.toString() || null
    if (req.body.assignedAgent) {
      const agent = await User.findOne({ _id: req.body.assignedAgent, role: { $in: ['agent', 'supervisor', 'admin'] }, isActive: true }).select('_id')
      if (!agent) return res.status(400).json({ message: 'Choose an active support staff account.' })
    }
    const changes = []
    for (const field of ['priority', 'assignedAgent', 'status']) {
      if (req.body[field] === undefined) continue
      const value = req.body[field]
      const oldValue = field === 'assignedAgent' ? ticket.assignedAgent?.toString() || null : ticket[field]
      if (oldValue !== value) {
        changes.push(`${field} changed from ${oldValue || 'none'} to ${value || 'none'}`)
        ticket[field] = value
      }
    }
    const statusBeforeAssignment = ticket.status
    if (req.body.status === undefined && req.body.assignedAgent) {
      ticket.status = 'assigned_to_agent'
    } else if (req.body.status === undefined && req.body.assignedAgent === null && ticket.status === 'assigned_to_agent') {
      ticket.status = 'pending'
    }
    if (ticket.status !== statusBeforeAssignment) {
      changes.push(`status changed from ${statusBeforeAssignment} to ${ticket.status}`)
    }
    if (!changes.length) return res.json({ ticket })
    await ticket.save()
    await writeAudit(req, 'ticket.updated', 'ticket', ticket.id, `Ticket ${ticket.id}: ${changes.join('; ')}`)
    const updated = await Ticket.findById(ticket.id).populate('customer', 'fullName email').populate('assignedAgent', 'fullName role').lean()
    const io = req.app.get('io')
    if (io) io.to(`ticket:${ticket.id}`).emit('ticket:updated', { ticketId: ticket.id, status: updated.status, assignedAgent: updated.assignedAgent })
    try {
      const notificationTasks = []
      if (previousAssignee !== (updated.assignedAgent?._id?.toString() || null) && updated.assignedAgent) {
        notificationTasks.push(
          notifyTicketAssignee(io, updated, req.user.id),
          notifyTicketCustomer(io, updated, req.user.id, {
            type: 'ticket_assigned',
            title: 'An agent was assigned to your ticket',
            message: `Your ticket #${ticket.id.slice(-6).toUpperCase()} is now assigned to support.`,
          }),
        )
      }
      if (previousStatus !== updated.status && updated.status === 'resolved') {
        notificationTasks.push(notifyTicketResolved(io, updated, req.user.id))
      } else if (previousStatus !== updated.status && updated.status === 'escalated') {
        notificationTasks.push(notifyTicketCustomer(io, updated, req.user.id, {
          type: 'ticket_escalated',
          title: 'Your ticket was escalated',
          message: `Ticket #${ticket.id.slice(-6).toUpperCase()} has been escalated for additional support.`,
        }))
      }
      await Promise.all(notificationTasks)
    } catch (notificationError) {
      console.error(`Ticket ${ticket.id} was updated, but its notification could not be saved.`, notificationError)
    }
    return res.json({ ticket: updated })
  } catch (error) {
    return next(error)
  }
}

export async function getAdminSettings(req, res, next) {
  try {
    const settings = await WorkspaceSettings.findOneAndUpdate(
      { key: 'workspace' },
      { $setOnInsert: { workspaceName: 'NEXA Support Desk', supportEmail: 'support@nexa.support' } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean()
    const { key, _id, createdAt, updatedAt, ...values } = settings
    return res.json({ settings: values })
  } catch (error) {
    return next(error)
  }
}

export async function updateAdminSettings(req, res, next) {
  try {
    const errors = getWorkspaceSettingsErrors(req.body || {})
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please correct the workspace settings.', errors })
    const settings = await WorkspaceSettings.findOneAndUpdate(
      { key: 'workspace' },
      { $set: Object.fromEntries(Object.entries(req.body).map(([key, value]) => [key, value.trim()])) },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean()
    await writeAudit(req, 'settings.updated', 'settings', 'workspace', `Workspace settings updated: ${Object.keys(req.body).join(', ')}`)
    const { key, _id, createdAt, updatedAt, ...values } = settings
    return res.json({ settings: values })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminAuditLogs(req, res, next) {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate('actor', 'fullName email role').lean()
    return res.json({ logs })
  } catch (error) {
    return next(error)
  }
}
