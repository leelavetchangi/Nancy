import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  AudioLines,
  Bot,
  Check,
  Clock3,
  Flame,
  RefreshCw,
  ShieldCheck,
  Ticket,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import { useAuth } from './useAuth.js'
import { TriageSidebar, TriageTopbar } from './TriagePages.jsx'
import api from './api.js'
import './AgentDashboard.css'

const queueOrder = ['critical', 'high', 'medium', 'low']
const niceLabel = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const ticketId = (ticket) => ticket?._id?.slice(-6).toUpperCase()

function useSlaClock(serverTime) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const drift = Date.now() - serverTime
    const timer = window.setInterval(() => setNow(Date.now() - drift), 1000)
    return () => window.clearInterval(timer)
  }, [serverTime])
  return now
}

function SlaCountdown({ deadline, now }) {
  const remaining = Math.max(0, new Date(deadline).getTime() - now)
  const overdue = remaining === 0
  const elapsedSeconds = overdue ? Math.floor((now - new Date(deadline).getTime()) / 1000) : 0
  const totalSeconds = overdue ? elapsedSeconds : Math.floor(remaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const label = overdue
    ? `Overdue by ${hours > 0 ? `${hours}h ` : ''}${String(minutes).padStart(2, '0')}m`
    : hours > 0
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const urgency = overdue ? 'overdue' : remaining <= 5 * 60 * 1000 ? 'urgent' : remaining <= 15 * 60 * 1000 ? 'at-risk' : 'on-track'
  return <span className={`agent-sla agent-sla-${urgency}`} aria-label={overdue ? 'SLA overdue' : `Response due in ${label}`}><Clock3 size={13} /><span>{overdue ? label : `Response due in ${label}`}</span></span>
}

function QueueCard({ priority, tickets, now, actingId, onAccept, onReply, onDraft, onEscalate, onResolve }) {
  const config = {
    critical: { icon: <Flame size={16} />, label: 'Critical', copy: 'Immediate attention required' },
    high: { icon: <AlertTriangle size={16} />, label: 'High', copy: 'Urgent customer requests' },
    medium: { icon: <Ticket size={16} />, label: 'Medium', copy: 'Standard response queue' },
    low: { icon: <Clock3 size={16} />, label: 'Low', copy: 'Lower urgency requests' },
  }[priority]
  const sortedTickets = [...tickets].sort((left, right) => new Date(left.slaDueAt) - new Date(right.slaDueAt))
  return (
    <section className={`agent-queue-card queue-${priority}`}>
      <header className="agent-queue-heading">
        <span className="agent-queue-icon">{config.icon}</span>
        <span><strong>{config.label}</strong><small>{config.copy}</small></span>
        <span className="agent-queue-count">{tickets.length}</span>
      </header>
      {tickets.length === 0 ? (
        <div className="agent-queue-empty"><Check size={14} /> No {config.label.toLowerCase()} priority tickets</div>
      ) : (
        <div className="agent-table-wrap">
          <table className="agent-ticket-table">
            <thead><tr><th>Ticket ID</th><th>Subject</th><th>Customer</th><th>Priority</th><th>SLA</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {sortedTickets.map((ticket) => {
                const isAssigned = Boolean(ticket.assignedAgent)
                const busy = actingId === ticket._id
                return (
                  <tr key={ticket._id} className={ticket.sla?.state === 'overdue' ? 'is-overdue' : ''}>
                    <td><Link className="agent-ticket-id" to={`/agent/chat?ticket=${ticketId(ticket)}`}>#{ticketId(ticket)}</Link></td>
                    <td><Link className="agent-ticket-subject" to={`/agent/chat?ticket=${ticketId(ticket)}`} title={ticket.subject}>{ticket.subject}<small>{niceLabel(ticket.category)}</small></Link></td>
                    <td><span className="agent-customer-name"><i>{ticket.customer?.fullName?.[0]?.toUpperCase() || 'C'}</i>{ticket.customer?.fullName || 'Customer'}</span></td>
                    <td><span className={`agent-priority priority-${priority}`}><i />{config.label}</span></td>
                    <td><SlaCountdown deadline={ticket.slaDueAt} now={now} /></td>
                    <td><span className={`agent-status status-${ticket.status}`}>{niceLabel(ticket.status)}</span></td>
                    <td>
                      <div className="agent-row-actions">
                        {!isAssigned && <button className="agent-action-accept" type="button" onClick={() => onAccept(ticket)} disabled={busy}>{busy ? 'Working…' : 'Accept'}</button>}
                        {isAssigned && <button className="agent-action-icon" type="button" onClick={() => onReply(ticket)} title="Reply in Live Chat" aria-label={`Reply to ticket ${ticketId(ticket)}`}><AudioLines size={14} /></button>}
                        <button className="agent-action-icon" type="button" onClick={() => onDraft(ticket)} title="Open AI Draft Reply" aria-label={`AI draft for ticket ${ticketId(ticket)}`}><Bot size={14} /></button>
                        {isAssigned && <button className="agent-action-icon action-resolve" type="button" onClick={() => onResolve(ticket)} disabled={busy} title="Resolve ticket" aria-label={`Resolve ticket ${ticketId(ticket)}`}><Check size={14} /></button>}
                        <button className="agent-action-icon action-escalate" type="button" onClick={() => onEscalate(ticket)} disabled={busy} title="Escalate to supervisor queue" aria-label={`Escalate ticket ${ticketId(ticket)}`}><UserRoundCheck size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function AgentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [serverTime, setServerTime] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actingId, setActingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const now = useSlaClock(serverTime)

  const loadQueue = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError('')
    try {
      const { data } = await api.get('/agent/tickets')
      setTickets(data.tickets)
      setServerTime(data.serverTime)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load ticket queues. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/agent/tickets')
      .then(({ data }) => {
        if (!active) return
        setTickets(data.tickets)
        setServerTime(data.serverTime)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load ticket queues. Please try again.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const grouped = useMemo(() => Object.fromEntries(queueOrder.map((priority) => [
    priority,
    tickets.filter((ticket) => ticket.priority === priority),
  ])), [tickets])
  const stats = useMemo(() => {
    const openTickets = tickets.filter((ticket) => !ticket.assignedAgent)
    return {
      total: tickets.length,
      assigned: tickets.filter((ticket) => String(ticket.assignedAgent?._id) === String(user?.id)).length,
      critical: openTickets.filter((ticket) => ticket.priority === 'critical').length,
      overdue: tickets.filter((ticket) => ticket.sla?.state === 'overdue').length,
    }
  }, [tickets, user?.id])

  const updateTicket = (updatedTicket) => {
    setTickets((current) => current.map((ticket) => ticket._id === updatedTicket._id
      ? { ...ticket, ...updatedTicket, sla: updatedTicket.sla || ticket.sla }
      : ticket))
  }

  const performAction = async (ticket, action, successText) => {
    setActingId(ticket._id)
    setError('')
    setNotice('')
    try {
      const { data } = await action(ticket._id)
      if (data.ticket) updateTicket(data.ticket)
      setNotice(successText)
      return true
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The ticket action could not be completed. Refresh the queue and try again.')
    } finally {
      setActingId('')
    }
  }

  const acceptTicket = (ticket) => performAction(
    ticket,
    (id) => api.post(`/agent/tickets/${id}/accept`),
    `Ticket #${ticketId(ticket)} assigned to you.`,
  )

  const escalateTicket = (ticket) => performAction(
    ticket,
    (id) => api.post(`/agent/tickets/${id}/escalate`),
    `Ticket #${ticketId(ticket)} escalated to the supervisor queue.`,
  )

  const resolveTicket = (ticket) => {
    if (!window.confirm(`Resolve ticket #${ticketId(ticket)}? You can send a final response in Live Chat before resolving.`)) return
    return performAction(
      ticket,
      (id) => api.post(`/agent/tickets/${id}/resolve`),
      `Ticket #${ticketId(ticket)} resolved.`,
    ).then((succeeded) => succeeded ? loadQueue(true) : undefined)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign out because the API is unreachable.')
      setLoggingOut(false)
    }
  }

  return (
    <div className="triage-app site-shell agent-dashboard">
      <TriageSidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} activeView="overview" />
      <div className="triage-main">
        <TriageTopbar user={user} onMenu={() => setMobileOpen(true)} title="Agent Dashboard" />
        <main className="triage-content agent-dashboard-content">
          <div className="triage-page-title-row agent-title-row">
            <div><p className="triage-kicker"><span /> NEXA SUPPORT OPERATIONS / AGENT VIEW</p><h1>Support Agent Dashboard</h1><p>Prioritize the next response, monitor SLAs, and keep every customer moving forward.</p></div>
            <button className="triage-refresh" type="button" onClick={() => loadQueue(true)} disabled={loading || refreshing}><RefreshCw size={14} className={refreshing ? 'is-refreshing' : ''} /> Refresh queue</button>
          </div>

          {notice && <div className="triage-notice" role="status"><Check size={15} />{notice}</div>}
          {error && <div className="triage-error" role="alert"><AlertTriangle size={15} /><span>{error}</span><button type="button" onClick={() => loadQueue(true)}>Retry</button></div>}

          <section className="agent-stats-grid" aria-label="Agent queue summary">
            <article><span className="agent-stat-icon stat-icon-blue"><Ticket size={16} /></span><span><small>Open tickets</small><strong>{loading ? '—' : stats.total}</strong></span><i>{loading ? 'Loading' : 'Across all priorities'}</i></article>
            <article><span className="agent-stat-icon stat-icon-violet"><UsersRound size={16} /></span><span><small>Assigned to you</small><strong>{loading ? '—' : stats.assigned}</strong></span><i>Your active workload</i></article>
            <article><span className="agent-stat-icon stat-icon-red"><Flame size={16} /></span><span><small>Critical priority</small><strong>{loading ? '—' : stats.critical}</strong></span><i>{stats.critical ? 'Needs fast response' : 'No critical tickets'}</i></article>
            <article><span className="agent-stat-icon stat-icon-amber"><Clock3 size={16} /></span><span><small>SLA overdue</small><strong>{loading ? '—' : stats.overdue}</strong></span><i>{stats.overdue ? 'Response target passed' : 'All within target'}</i></article>
          </section>

          <div className="agent-queue-intro"><div><p className="triage-kicker"><span /> PRIORITY QUEUES</p><h2>Ticket queues <span>{tickets.length}</span></h2></div><div className="agent-sla-legend"><span><i className="legend-track" />On track</span><span><i className="legend-risk" />At risk</span><span><i className="legend-overdue" />Overdue</span></div></div>

          {loading ? (
            <div className="agent-loading-state" role="status"><span className="triage-spinner" /><p>Loading priority queues…</p></div>
          ) : (
            <div className="agent-queues">
              {queueOrder.map((priority) => <QueueCard
                key={priority}
                priority={priority}
                tickets={grouped[priority]}
                now={now}
                actingId={actingId}
                onAccept={acceptTicket}
                onReply={(ticket) => navigate(`/agent/chat?ticket=${ticketId(ticket)}`)}
                onDraft={(ticket) => navigate(`/agent/draft-reply?ticket=${ticketId(ticket)}`)}
                onEscalate={escalateTicket}
                onResolve={resolveTicket}
              />)}
            </div>
          )}
          <footer className="triage-footer"><span>© 2026 NEXA Support Desk</span><span><ShieldCheck size={12} /> SLA targets: Critical 15m · High 1h · Medium 4h · Low 24h</span></footer>
        </main>
      </div>
    </div>
  )
}
