import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from './useAuth.js'
import api from './api.js'
import './Customer.css'

const statusLabels = {
  pending: 'Pending',
  ai_processing: 'AI Processing',
  assigned_to_agent: 'Assigned to Agent',
  resolved: 'Resolved',
  escalated: 'Escalated',
  closed: 'Closed',
}

const priorities = ['low', 'medium', 'high', 'critical']

function formatDate(date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

export function DashboardSidebar({ active, onLogout, loggingOut }) {
  return (
    <aside className="customer-sidebar">
      <Link className="brand customer-brand" to="/" aria-label="NEXA home">
        <img className="brand-mark" src="/nexa-mark.svg" alt="" />
        <span className="brand-word">NEXA</span>
      </Link>
      <div className="customer-workspace">
        <span className="workspace-avatar">N</span>
        <span><strong>Support Desk</strong><small>Customer workspace</small></span>
        <ChevronRight size={14} />
      </div>
      <p className="sidebar-label">WORKSPACE</p>
      <nav className="customer-side-nav" aria-label="Customer workspace">
        <Link className={active === 'overview' ? 'active' : ''} to="/customer/dashboard"><LayoutDashboard size={16} /> Overview</Link>
        <Link className={active === 'tickets' ? 'active' : ''} to="/customer/tickets"><Ticket size={16} /> My Tickets</Link>
        <Link className={active === 'create' ? 'active' : ''} to="/customer/tickets/new"><FilePlus2 size={16} /> Create Ticket</Link>
        <Link to="/customer/chat"><AudioLines size={16} /> Live Chat</Link>
        <Link className={active === 'notifications' ? 'active' : ''} to="/customer/notifications"><Bell size={16} /> Notifications</Link>
        <Link className={active === 'csat' ? 'active' : ''} to="/customer/csat"><Star size={16} /> Feedback</Link>
      </nav>
      <p className="sidebar-label sidebar-label-tools">SUPPORT</p>
      <Link className="customer-side-nav-link" to="/customer/knowledge"><BookOpen size={16} /> Knowledge Base</Link>
      <div className="sidebar-bottom">
        <div className="sidebar-security"><ShieldCheck size={14} /><span>Secure workspace<br /><strong>Session protected</strong></span><i /></div>
        <button className="sidebar-logout" type="button" onClick={onLogout} disabled={loggingOut}>
          <LogOut size={15} /> {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <div className="sidebar-version">NEXA DESK <span>•</span> CUSTOMER</div>
      </div>
    </aside>
  )
}

export function CustomerTopbar({ name, onSearch }) {
  return (
    <header className="customer-topbar">
      <div className="customer-breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>Customer desk</strong></div>
      <div className="customer-top-actions">
        {onSearch && <button className="customer-search" type="button" onClick={onSearch}><Search size={15} /><span>Search tickets</span><kbd>⌘ K</kbd></button>}
        <span className="customer-top-avatar">{name?.[0]?.toUpperCase() || 'N'}</span>
      </div>
    </header>
  )
}

function TicketStatus({ status }) {
  return <span className={`ticket-status status-${status}`}><i />{statusLabels[status] || 'Pending'}</span>
}

function TicketPriority({ priority }) {
  return <span className={`ticket-priority priority-${priority}`}>{priority}</span>
}

function TicketDetails({ ticket, onClose, onTicketUpdated, onTicketDeleted }) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [files, setFiles] = useState([])
  const [downloadBusy, setDownloadBusy] = useState('')
  useEffect(() => {
    let active = true
    api.get(`/tickets/${ticket._id}`)
      .then(({ data }) => {
        if (!active) return
        setDetails(data.ticket)
        setEditForm({
          subject: data.ticket.subject,
          description: data.ticket.description,
          category: data.ticket.category,
          priority: data.ticket.priority,
        })
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load this ticket.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [ticket._id])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const updateTicket = (nextTicket) => {
    setDetails(nextTicket)
    setEditForm({
      subject: nextTicket.subject,
      description: nextTicket.description,
      category: nextTicket.category,
      priority: nextTicket.priority,
    })
    setEditing(false)
  }

  const submitEdit = async (event) => {
    event.preventDefault()
    setError('')
    setActionBusy(true)
    try {
      const { data } = await api.put(`/tickets/${ticket._id}`, editForm)
      updateTicket(data.ticket)
      onTicketUpdated(data.ticket)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this ticket.')
    } finally {
      setActionBusy(false)
    }
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!message.trim()) return
    setError('')
    setActionBusy(true)
    try {
      const { data } = await api.post(`/tickets/${ticket._id}/messages`, { body: message })
      setMessage('')
      updateTicket(data.ticket)
      onTicketUpdated(data.ticket)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send your message.')
    } finally {
      setActionBusy(false)
    }
  }

  const closeTicket = async () => {
    setError('')
    setActionBusy(true)
    try {
      const { data } = await api.post(`/tickets/${ticket._id}/close`)
      updateTicket(data.ticket)
      onTicketUpdated(data.ticket)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to close this ticket.')
    } finally {
      setActionBusy(false)
    }
  }

  const deleteTicket = async () => {
    if (!window.confirm('Delete this unassigned ticket? This cannot be undone.')) return
    setError('')
    setActionBusy(true)
    try {
      await api.delete(`/tickets/${ticket._id}`)
      onTicketDeleted(ticket._id)
      onClose()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete this ticket.')
    } finally {
      setActionBusy(false)
    }
  }

  const uploadAttachments = async (event) => {
    event.preventDefault()
    if (!files.length) return
    setError('')
    setActionBusy(true)
    try {
      const body = new FormData()
      files.forEach((file) => body.append('attachments', file))
      const { data } = await api.post(`/tickets/${ticket._id}/attachments`, body)
      setFiles([])
      updateTicket(data.ticket)
      onTicketUpdated(data.ticket)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to upload attachments.')
    } finally {
      setActionBusy(false)
    }
  }

  const downloadAttachment = async (attachment) => {
    setError('')
    setDownloadBusy(attachment._id)
    try {
      const { data } = await api.get(`/tickets/${ticket._id}/attachments/${attachment._id}`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.originalName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to download this attachment.')
    } finally {
      setDownloadBusy('')
    }
  }

  return (
    <div className="ticket-details-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="ticket-details-panel" role="dialog" aria-modal="true" aria-labelledby="ticket-details-title">
        <button className="icon-button ticket-details-close" type="button" onClick={onClose} aria-label="Close ticket details"><X size={18} /></button>
        <p className="eyebrow"><span className="eyebrow-line" /> TICKET / {ticket._id.slice(-6).toUpperCase()}</p>
        {error && <div className="customer-error" role="alert"><CircleHelp size={15} /><span>{error}</span></div>}
        {loading ? <div className="ticket-empty-state" role="status"><span className="loading-ring" /><p>Loading ticket…</p></div> : details && (
          <>
            <h2 id="ticket-details-title">{details.subject}</h2>
            <div className="ticket-details-meta"><TicketStatus status={details.status} /><TicketPriority priority={details.priority} /><span>{details.category}</span></div>
            <p className="ticket-details-date">Created {formatDate(details.createdAt)} · Updated {formatDate(details.updatedAt)}</p>
            {editing ? (
              <form className="ticket-edit-form" onSubmit={submitEdit}>
                <label>Subject<input value={editForm.subject} maxLength={120} onChange={(event) => setEditForm((current) => ({ ...current, subject: event.target.value }))} required /></label>
                <div className="ticket-form-row">
                  <label>Category<select value={editForm.category} onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}><option value="technical">Technical</option><option value="billing">Billing</option><option value="account">Account</option><option value="product">Product</option><option value="other">Other</option></select></label>
                  <label>Priority<select value={editForm.priority} onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value }))}>{priorities.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
                </div>
                <label>Description<textarea value={editForm.description} maxLength={5000} rows={5} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} required /></label>
                <div className="ticket-detail-actions"><button className="button button-quiet" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={actionBusy}>{actionBusy ? 'Saving…' : 'Save changes'}</button></div>
              </form>
            ) : (
              <>
                <div className="ticket-conversation">
                  <article className="conversation-message conversation-customer">
                    <div className="conversation-message-head"><span>{'You'}</span><time>{formatDate(details.createdAt)}</time></div>
                    <p>{details.description}</p>
                  </article>
                  {(details.messages || []).map((reply) => (
                    <article className={`conversation-message${reply.author?.role === 'customer' ? ' conversation-customer' : ' conversation-support'}`} key={reply._id}>
                      <div className="conversation-message-head"><span>{reply.author?.fullName || 'NEXA Support'}{reply.author?.role && reply.author.role !== 'customer' ? ' · Support' : ''}</span><time>{formatDate(reply.createdAt)}</time></div>
                      <p>{reply.body}</p>
                    </article>
                  ))}
                </div>
                <section className="ticket-attachments">
                  <div className="ticket-subsection-heading"><Paperclip size={14} /><strong>Attachments</strong><span>{details.attachments?.length || 0}/3</span></div>
                  {(details.attachments || []).length > 0 ? (
                    <div className="ticket-attachment-list">
                      {details.attachments.map((attachment) => <button type="button" key={attachment._id} onClick={() => downloadAttachment(attachment)} disabled={downloadBusy === attachment._id}><Paperclip size={13} /><span>{attachment.originalName}<small>{Math.max(1, Math.round(attachment.size / 1024))} KB · {attachment.contentType.split('/')[1].toUpperCase()}</small></span><span>{downloadBusy === attachment._id ? 'Loading…' : 'Download'}</span></button>)}
                    </div>
                  ) : <p className="ticket-no-attachments">No files attached.</p>}
                  {details.status !== 'closed' && details.attachments?.length < 3 && (
                    <form className="ticket-attachment-form" onSubmit={uploadAttachments}>
                      <label className="attachment-picker"><Paperclip size={14} /><span>{files.length ? `${files.length} file(s) selected` : 'Choose PDF, JPG, PNG, or WebP'}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>
                      <button className="ticket-mini-action" type="submit" disabled={!files.length || actionBusy}>Upload</button>
                    </form>
                  )}
                </section>
                {['resolved', 'closed'].includes(details.status) && (
                  details.csat?.submittedAt ? (
                    <section className="ticket-csat-panel" aria-label="Submitted satisfaction rating">
                      <div><Star size={14} /><strong>Your feedback</strong></div>
                      <p>{'★'.repeat(details.csat.rating)}<span>{'★'.repeat(5 - details.csat.rating)}</span> <small>{details.csat.rating} out of 5 · Thank you for helping us improve.</small></p>
                      {details.csat.comment && <blockquote>{details.csat.comment}</blockquote>}
                    </section>
                  ) : (
                    <section className="ticket-csat-panel">
                      <div><Star size={14} /><strong>How did we do?</strong></div>
                      <p className="ticket-csat-prompt">Your support experience matters to us.</p>
                      <Link className="ticket-mini-action ticket-csat-link" to={`/customer/csat?ticket=${ticket._id}`}>Share your feedback <ArrowRight size={12} /></Link>
                    </section>
                  )
                )}
                {details.status !== 'closed' && (
                  <form className="ticket-message-form" onSubmit={sendMessage}>
                    <label htmlFor="ticket-reply">Add a message</label>
                    <textarea id="ticket-reply" value={message} maxLength={2000} rows={3} onChange={(event) => setMessage(event.target.value)} placeholder="Add information or reply to support…" />
                    <div><small>{message.length}/2000 · Sending a reply reopens a resolved ticket.</small><button className="button button-primary" type="submit" disabled={!message.trim() || actionBusy}>{actionBusy ? 'Sending…' : 'Send'} <Send size={13} /></button></div>
                  </form>
                )}
                <div className="ticket-detail-actions ticket-detail-actions-footer">
                  {details.status === 'pending' && !details.assignedAgent && !details.messages?.length && <button className="ticket-danger-action" type="button" onClick={deleteTicket} disabled={actionBusy}><Trash2 size={13} /> Delete</button>}
                  {details.status === 'pending' && !details.assignedAgent && !details.messages?.length && <button className="button button-quiet" type="button" onClick={() => setEditing(true)} disabled={actionBusy}><Pencil size={13} /> Edit</button>}
                  {details.status !== 'closed' && <button className="button button-quiet" type="button" onClick={closeTicket} disabled={actionBusy}>Close ticket</button>}
                  {details.status === 'closed' && <span className="ticket-closed-note"><Check size={13} /> This ticket is closed.</span>}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export function CustomerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    api.get('/tickets')
      .then(({ data }) => {
        if (!active) return
        setTickets(data.tickets)
        const requestedTicket = new URLSearchParams(location.search).get('ticket')?.replace(/[^a-z0-9]/gi, '').toUpperCase()
        if (requestedTicket) {
          const matchedTicket = data.tickets.find((ticket) =>
            ticket._id.toUpperCase().endsWith(requestedTicket)
            || ticket._id.slice(-6).toUpperCase() === requestedTicket,
          )
          if (matchedTicket) setSelectedTicket(matchedTicket)
          else setError(`Ticket ${requestedTicket} was not found in your account.`)
        }
        if (location.state?.ticketCreated) {
          setSuccessMessage('Your ticket was created successfully.')
          navigate(location.pathname, { replace: true, state: {} })
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load your tickets. Please try again.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [location.pathname, location.search, location.state?.ticketCreated, navigate])

  const summary = useMemo(() => ({
    total: tickets.length,
    pending: tickets.filter((ticket) => ticket.status === 'pending').length,
    ai: tickets.filter((ticket) => ticket.status === 'ai_processing').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved').length,
  }), [tickets])

  const filteredTickets = tickets.filter((ticket) => {
    const query = search.trim().toLowerCase()
    const requestedPriority = new URLSearchParams(location.search).get('priority')?.toLowerCase()
    if (requestedPriority && ticket.priority !== requestedPriority) return false
    return !query || ticket.subject.toLowerCase().includes(query)
      || ticket._id.toLowerCase().includes(query)
      || ticket.category.toLowerCase().includes(query)
  })

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign out because the NEXA API is unreachable.')
      setLoggingOut(false)
    }
  }

  const handleTicketUpdated = (updatedTicket) => {
    setTickets((current) => current.map((ticket) => ticket._id === updatedTicket._id ? { ...ticket, ...updatedTicket } : ticket))
    setSelectedTicket((current) => current ? { ...current, ...updatedTicket } : current)
  }

  const handleTicketDeleted = (ticketId) => {
    setTickets((current) => current.filter((ticket) => ticket._id !== ticketId))
    setSuccessMessage('The ticket was deleted.')
  }

  return (
    <div className="customer-app site-shell">
      <DashboardSidebar active={location.pathname.endsWith('/tickets') ? 'tickets' : location.pathname.endsWith('/csat') ? 'csat' : 'overview'} onLogout={handleLogout} loggingOut={loggingOut} />
      <div className="customer-main">
        <CustomerTopbar name={user?.fullName} onSearch={() => document.getElementById('ticket-search')?.focus()} />
        <main className="customer-content">
          <div className="customer-greeting-row">
            <div>
              <p className="eyebrow"><span className="live-dot" /> CUSTOMER WORKSPACE</p>
              <h1>Good Morning <span className="greeting-wave">👋</span></h1>
              <p className="customer-greeting-sub">Here’s the latest on your support requests, {user?.fullName?.split(' ')[0] || 'there'}.</p>
            </div>
            <Link className="button button-primary create-ticket-button" to="/customer/tickets/new"><Plus size={17} /> Create New Ticket</Link>
          </div>

          {successMessage && <div className="ticket-success" role="status"><Check size={15} /> {successMessage}</div>}
          {error && <div className="customer-error" role="alert"><CircleHelp size={16} /><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}

          <section className="ticket-stats-grid" aria-label="Ticket summary">
            {[
              { label: 'Total Tickets', value: summary.total, icon: <Ticket size={17} />, tone: 'blue', trend: 'All requests' },
              { label: 'Pending', value: summary.pending, icon: <Clock3 size={17} />, tone: 'amber', trend: 'Awaiting response' },
              { label: 'AI Processing', value: summary.ai, icon: <Sparkles size={17} />, tone: 'violet', trend: 'Being reviewed' },
              { label: 'Resolved', value: summary.resolved, icon: <Check size={17} />, tone: 'green', trend: 'Successfully closed' },
            ].map((stat) => (
              <article className={`ticket-stat stat-${stat.tone}`} key={stat.label}>
                <div className="ticket-stat-top"><span>{stat.label}</span><i>{stat.icon}</i></div>
                <strong>{loading ? <span className="stat-loading" /> : stat.value}</strong>
                <span className="ticket-stat-caption"><ArrowDownRight size={13} /> {stat.trend}</span>
              </article>
            ))}
          </section>

          <section className="customer-ticket-panel" id="tickets">
            <div className="ticket-panel-heading">
              <div><p className="eyebrow"><span className="eyebrow-line" /> YOUR SUPPORT ACTIVITY</p><h2>{location.pathname.endsWith('/tickets') ? 'My Tickets' : 'Recent Tickets'}</h2></div>
              <label className="ticket-search-wrap" htmlFor="ticket-search"><Search size={15} /><input id="ticket-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets" /></label>
            </div>
            {loading ? (
              <div className="ticket-empty-state" role="status"><span className="loading-ring" /><p>Loading your tickets…</p></div>
            ) : filteredTickets.length === 0 ? (
              <div className="ticket-empty-state">
                <span className="empty-ticket-icon"><Ticket size={21} /></span>
                <h3>{search ? 'No matching tickets' : 'Your support desk is clear'}</h3>
                <p>{search ? 'Try a different ticket ID, subject, or category.' : new URLSearchParams(location.search).has('priority') ? 'No tickets match the requested priority filter.' : 'When you create a support request, it will appear here with live status updates.'}</p>
                {!search && <Link className="text-link" to="/customer/tickets/new">Create your first ticket <ArrowRight size={15} /></Link>}
              </div>
            ) : (
              <>
                <div className="ticket-table-scroll">
                  <table className="customer-ticket-table">
                    <thead><tr><th>Ticket ID</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {filteredTickets.map((ticket) => (
                        <tr key={ticket._id}>
                          <td data-label="Ticket ID"><span className="ticket-id">#{ticket._id.slice(-6).toUpperCase()}</span></td>
                          <td data-label="Subject"><button className="ticket-subject-button" type="button" onClick={() => setSelectedTicket(ticket)}>{ticket.subject}<small>{formatDate(ticket.createdAt)}</small></button></td>
                          <td data-label="Category"><span className="ticket-category">{ticket.category}</span></td>
                          <td data-label="Priority"><TicketPriority priority={ticket.priority} /></td>
                          <td data-label="Status"><TicketStatus status={ticket.status} /></td>
                          <td data-label="Action"><button className="ticket-view-button" type="button" onClick={() => setSelectedTicket(ticket)}>View <ArrowRight size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ticket-table-footer"><span>Showing {filteredTickets.length} of {tickets.length} tickets</span><Link to="/customer/tickets">View all tickets <ArrowRight size={13} /></Link></div>
              </>
            )}
          </section>
          <footer className="customer-footer"><span>© 2026 NEXA Support Desk</span><span>AI-Powered. Human-Centered. Always On.</span></footer>
        </main>
      </div>
      {selectedTicket && (
        <TicketDetails
          key={selectedTicket._id}
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onTicketUpdated={handleTicketUpdated}
          onTicketDeleted={handleTicketDeleted}
        />
      )}
    </div>
  )
}

export function CreateTicketPage() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ subject: '', description: '', category: 'technical', priority: 'medium' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [files, setFiles] = useState([])

  const update = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const errors = {}
    if (form.subject.trim().length < 4 || form.subject.trim().length > 120) errors.subject = 'Use 4–120 characters.'
    if (form.description.trim().length < 10 || form.description.trim().length > 5000) errors.description = 'Use 10–5,000 characters.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    if (files.length > 3) {
      setError('Attach no more than 3 files.')
      return
    }
    if (files.some((file) => file.size > 2 * 1024 * 1024)) {
      setError('Each attachment must be smaller than 2 MB.')
      return
    }

    setSubmitting(true)
    try {
      const body = new FormData()
      Object.entries(form).forEach(([name, value]) => body.append(name, value))
      files.forEach((file) => body.append('attachments', file))
      const { data } = await api.post('/tickets', body)
      if (location.state?.returnToLiveChat && data.ticket?._id) {
        navigate(`/customer/chat?ticket=${data.ticket._id.slice(-6)}`, { replace: true })
      } else {
        navigate('/customer/dashboard', { replace: true, state: { ticketCreated: true } })
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create your ticket. Check your connection and try again.')
      setFieldErrors(requestError.response?.data?.errors || {})
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign out because the NEXA API is unreachable.')
    }
  }

  return (
    <div className="customer-app site-shell">
      <DashboardSidebar active="create" onLogout={handleLogout} />
      <div className="customer-main">
        <CustomerTopbar name={user?.fullName} />
        <main className="customer-content new-ticket-content">
          <Link className="customer-back-link" to="/customer/dashboard"><ArrowLeft size={15} /> Back to dashboard</Link>
          <div className="customer-greeting-row new-ticket-heading">
            <div><p className="eyebrow"><span className="live-dot" /> CUSTOMER WORKSPACE / NEW REQUEST</p><h1>Create a ticket</h1><p className="customer-greeting-sub">Tell us what’s happening. We’ll route your request to the right support team.</p></div>
          </div>
          <section className="new-ticket-card">
            <div className="new-ticket-card-heading"><span className="new-ticket-icon"><FilePlus2 size={18} /></span><span><strong>Support request</strong><small>Fields marked with * are required.</small></span></div>
            {error && <div className="customer-error" role="alert"><CircleHelp size={16} /><span>{error}</span></div>}
            <form className="new-ticket-form" onSubmit={submit} noValidate>
              <label htmlFor="ticket-subject">Subject <span>*</span></label>
              <input id="ticket-subject" name="subject" value={form.subject} onChange={update} placeholder="A short summary of the issue" maxLength={120} required aria-invalid={Boolean(fieldErrors.subject)} />
              {fieldErrors.subject && <small className="ticket-field-error">{fieldErrors.subject}</small>}
              <div className="ticket-form-row">
                <div><label htmlFor="ticket-category">Category <span>*</span></label>
                  <select id="ticket-category" name="category" value={form.category} onChange={update}>
                    <option value="technical">Technical</option><option value="billing">Billing</option><option value="account">Account</option><option value="product">Product</option><option value="other">Other</option>
                  </select>
                </div>
                <div><label htmlFor="ticket-priority">Priority <span>*</span></label>
                  <select id="ticket-priority" name="priority" value={form.priority} onChange={update}>
                    {priorities.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              {fieldErrors.category && <small className="ticket-field-error">{fieldErrors.category}</small>}
              {fieldErrors.priority && <small className="ticket-field-error">{fieldErrors.priority}</small>}
              <label htmlFor="ticket-description">How can we help? <span>*</span></label>
              <textarea id="ticket-description" name="description" value={form.description} onChange={update} placeholder="Share the details of your request. Include what you were trying to do and what happened." rows={7} maxLength={5000} required aria-invalid={Boolean(fieldErrors.description)} />
              <div className="description-meta">{fieldErrors.description ? <small className="ticket-field-error">{fieldErrors.description}</small> : <small>Minimum 10 characters</small>}<small>{form.description.length}/5000</small></div>
              <label htmlFor="ticket-attachments">Attachments <span>(optional, up to 3 files / 2 MB each)</span></label>
              <input id="ticket-attachments" className="ticket-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} />
              {files.length > 0 && <small className="ticket-file-list">{files.map((file) => file.name).join(' · ')}</small>}
              <div className="ticket-form-actions"><Link className="button button-quiet" to="/customer/dashboard">Cancel</Link><button className="button button-primary" type="submit" disabled={submitting}>{submitting ? 'Creating ticket…' : 'Create New Ticket'} {!submitting && <ArrowRight size={15} />}</button></div>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
