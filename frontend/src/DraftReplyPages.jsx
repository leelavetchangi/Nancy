import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  LoaderCircle,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react'
import { useAuth } from './useAuth.js'
import api from './api.js'
import { TriageSidebar, TriageTopbar } from './TriagePages.jsx'
import './DraftReply.css'

const ticketId = (ticket) => ticket?._id?.slice(-6).toUpperCase()
const prettyLabel = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const dateTime = (value) => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : ''

function ConfidenceBadge({ value }) {
  const percentage = Math.round(value * 100)
  return (
    <div className="reply-confidence" style={{ '--reply-confidence': `${percentage}%` }} aria-label={`AI confidence ${percentage}%`}>
      <div><strong>{percentage}<small>%</small></strong><span>CONFIDENCE</span></div>
    </div>
  )
}

function CustomerConversation({ ticket }) {
  const messages = ticket.messages || []
  return (
    <section className="reply-panel reply-customer-panel">
      <header className="reply-panel-heading">
        <div><p className="triage-kicker"><span /> CUSTOMER CONTEXT</p><h2><MessageSquareText size={18} /> Customer Message</h2></div>
        <span className="reply-ticket-id">#{ticketId(ticket)}</span>
      </header>
      <div className="reply-ticket-meta">
        <div><span>SUBJECT</span><strong>{ticket.subject}</strong></div>
        <div><span>PRIORITY</span><strong className={`reply-priority priority-${ticket.priority}`}>{prettyLabel(ticket.priority)}</strong></div>
        <div><span>CATEGORY</span><strong>{prettyLabel(ticket.category)}</strong></div>
      </div>
      <div className="reply-conversation">
        <article className="reply-message">
          <div className="reply-message-head">
            <span className="reply-avatar customer-avatar">{ticket.customer?.fullName?.[0]?.toUpperCase() || 'C'}</span>
            <span><strong>{ticket.customer?.fullName || 'Customer'}</strong><small>Original request · {dateTime(ticket.createdAt)}</small></span>
          </div>
          <p>{ticket.description}</p>
        </article>
        {messages.map((message) => {
          const isCustomer = message.author?.role === 'customer'
          return (
            <article className={`reply-message${isCustomer ? '' : ' support-message'}`} key={message._id}>
              <div className="reply-message-head">
                <span className={`reply-avatar${isCustomer ? ' customer-avatar' : ''}`}>{message.author?.fullName?.[0]?.toUpperCase() || (isCustomer ? 'C' : 'N')}</span>
                <span><strong>{message.author?.fullName || (isCustomer ? 'Customer' : 'NEXA support')}</strong><small>{isCustomer ? 'Customer' : 'Support'} · {dateTime(message.createdAt)}</small></span>
              </div>
              <p>{message.body}</p>
            </article>
          )
        })}
        {messages.length === 0 && (
          <div className="reply-context-note"><Clock3 size={14} /><span>This is the first customer message. Reply context will appear here as the conversation continues.</span></div>
        )}
      </div>
      <div className="reply-context-footer"><ShieldCheck size={14} /><span>Review the complete conversation before sending a response.</span></div>
    </section>
  )
}

function DraftComposer({ ticket, providerConfigured, busy, onGenerate, onSave, onApprove, onEscalate }) {
  const draft = ticket.draftReply
  const [editing, setEditing] = useState(!draft?.text)
  const [text, setText] = useState(draft?.text || '')
  const [editError, setEditError] = useState('')
  const canSave = text.trim().length >= 10 && text.trim().length <= 2000

  const saveDraft = async () => {
    setEditError('')
    try {
      await onSave(text)
      setEditing(false)
    } catch (error) {
      setEditError(error)
    }
  }

  return (
    <section className="reply-panel reply-draft-panel">
      <header className="reply-panel-heading">
        <div><p className="triage-kicker"><span /> HUMAN APPROVAL REQUIRED</p><h2><Bot size={19} /> AI Generated Reply</h2></div>
        <span className="reply-draft-status"><i /> {draft?.text ? 'DRAFT READY' : 'AWAITING DRAFT'}</span>
      </header>

      <div className="reply-ai-toolbar">
        <div className="reply-ai-brand"><span><Sparkles size={15} /></span><div><strong>{draft?.provider === 'manual' ? 'Human-authored draft' : 'NEXA reply assistant'}</strong><small>{draft?.provider === 'ai' ? 'AI suggestion · always review before sending' : draft?.provider === 'manual' ? 'Saved manually · no AI confidence available' : 'Drafts require a configured AI provider or a human-written reply'}</small></div></div>
        {draft?.provider === 'ai' && typeof draft.confidence === 'number' && <ConfidenceBadge value={draft.confidence} />}
      </div>

      {draft?.suggestedActions?.length > 0 && (
        <div className="reply-suggestions">
          <div className="reply-subheading"><span><Sparkles size={14} /></span><strong>Suggested Actions</strong><small>AI suggestions · verify before acting</small></div>
          <ul>{draft.suggestedActions.map((action, index) => <li key={`${index}-${action}`}><Check size={13} />{action}</li>)}</ul>
        </div>
      )}

      <div className={`reply-editor${editing ? ' is-editing' : ''}`}>
        <div className="reply-editor-heading"><span><FileText size={14} /> RESPONSE DRAFT</span>{!editing && <button type="button" onClick={() => setEditing(true)} disabled={busy}><Pencil size={13} /> Edit Reply</button>}</div>
        {editing ? (
          <>
            <label className="sr-only" htmlFor={`reply-${ticket._id}`}>Edit support reply</label>
            <textarea id={`reply-${ticket._id}`} value={text} maxLength={2000} onChange={(event) => { setText(event.target.value); setEditError('') }} placeholder="Write a helpful, personal response for the customer…" />
            <div className="reply-editor-foot"><span className={text.trim().length > 2000 ? 'over-limit' : ''}>{text.trim().length} / 2,000</span><button className="reply-save-button" type="button" onClick={saveDraft} disabled={!canSave || busy}><Check size={14} /> Save draft</button></div>
            {!draft?.text && <p className="reply-manual-hint">You can save a manual response while AI drafting is unavailable.</p>}
          </>
        ) : (
          <div className="reply-draft-copy" aria-live="polite">{draft?.text}</div>
        )}
        {editError && <p className="reply-inline-error" role="alert">{editError}</p>}
      </div>

      {!providerConfigured && (
        <div className="reply-provider-warning"><CircleHelp size={15} /><span><strong>AI reply provider not configured.</strong> No simulated AI output is shown. Write a manual reply or configure <code>AI_DRAFT_URL</code> to enable generation.</span></div>
      )}

      <div className="reply-actions">
        <button className="reply-generate-button" type="button" onClick={onGenerate} disabled={!providerConfigured || busy}>
          {busy ? <LoaderCircle size={15} className="reply-spinning" /> : <Sparkles size={15} />}
          {busy ? 'Generating…' : draft?.provider === 'ai' ? 'Regenerate AI reply' : 'Generate AI reply'}
        </button>
        <div className="reply-action-row">
          <button className="reply-escalate-button" type="button" onClick={onEscalate} disabled={busy}><UserRoundCheck size={15} /> Escalate to Human</button>
          <button className="reply-approve-button" type="button" onClick={onApprove} disabled={!draft?.text || editing || busy}><Send size={14} /> Approve &amp; Send</button>
        </div>
        <p className="reply-action-disclosure"><ShieldCheck size={12} /> Sending posts this reply to the conversation and marks the ticket resolved.</p>
      </div>
    </section>
  )
}

export function DraftReplyPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tickets, setTickets] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [providerConfigured, setProviderConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const ticket = tickets.find((item) => item._id === selectedId)

  const applyQueue = useCallback((data) => {
    setTickets(data.tickets)
    setProviderConfigured(data.providerConfigured)
    setSelectedId((current) => {
      if (data.tickets.some((item) => item._id === current)) return current
      const requestedId = searchParams.get('ticket')?.toLowerCase()
      const requestedTicket = requestedId
        ? data.tickets.find((item) => item._id.toLowerCase().endsWith(requestedId))
        : undefined
      return requestedTicket?._id || data.tickets[0]?._id || ''
    })
  }, [searchParams])

  const refreshQueue = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      const { data } = await api.get('/ai/replies/tickets')
      applyQueue(data)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load reply approvals. Please try again.')
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [applyQueue])

  useEffect(() => {
    let active = true
    api.get('/ai/replies/tickets')
      .then(({ data }) => { if (active) applyQueue(data) })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load reply approvals. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [applyQueue])

  const updateTicket = (updated) => {
    setTickets((current) => current.map((item) => item._id === updated._id ? updated : item))
    setNotice('')
  }

  const runTicketAction = async (action, successMessage) => {
    if (!ticket || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data } = await action(ticket._id)
      if (successMessage === 'Reply approved and sent. Ticket resolved.') {
        setTickets((current) => current.filter((item) => item._id !== ticket._id))
        setSelectedId((current) => current === ticket._id ? (tickets.find((item) => item._id !== ticket._id)?._id || '') : current)
      } else {
        updateTicket(data.ticket)
      }
      setNotice(successMessage)
      return data
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'The request failed. No changes were saved.'
      setError(message)
      throw message
    } finally {
      setBusy(false)
    }
  }

  const generateDraft = () => runTicketAction(
    (id) => api.post(`/ai/replies/tickets/${id}/generate`, {}, { timeout: 35_000 }),
    'AI reply draft generated. Review it before sending.',
  )
  const saveDraft = async (text) => {
    const data = await runTicketAction(
      (id) => api.put(`/ai/replies/tickets/${id}/draft`, { text }),
      'Draft saved. It has not been sent.',
    )
    return data
  }
  const approveDraft = () => runTicketAction(
    (id) => api.post(`/ai/replies/tickets/${id}/approve`),
    'Reply approved and sent. Ticket resolved.',
  )
  const escalateTicket = () => runTicketAction(
    (id) => api.post(`/ai/replies/tickets/${id}/escalate`),
    'Ticket escalated and assigned to you for human follow-up.',
  )

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
    <div className="triage-app site-shell">
      <TriageSidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} activeView="draft" />
      <div className="triage-main">
        <TriageTopbar user={user} onMenu={() => setMobileOpen(true)} title="AI Draft Reply" />
        <main className="triage-content reply-content">
          <div className="triage-page-title-row reply-title-row">
            <div><p className="triage-kicker"><span /> NEXA INTELLIGENCE / HUMAN APPROVAL</p><h1>AI Draft Reply</h1><p>Turn thoughtful AI suggestions into customer-ready support—with a human always in control.</p></div>
            <button className="triage-refresh" type="button" onClick={refreshQueue} disabled={loading || refreshing}><RefreshCw size={14} className={refreshing ? 'is-refreshing' : ''} /> Refresh queue</button>
          </div>

          <div className={`reply-provider-banner${providerConfigured ? ' reply-provider-active' : ''}`}>
            <CircleHelp size={16} />
            {providerConfigured
              ? <p><strong>AI provider connected.</strong> Ticket subject, description, and recent conversation are sent to the configured provider. Review and approve every draft before it is sent.</p>
              : <p><strong>AI drafting is not configured.</strong> NEXA will not invent AI replies. You can still write, save, and send a human-authored response.</p>}
          </div>
          {notice && <div className="triage-notice" role="status"><Check size={15} />{notice}</div>}
          {error && <div className="triage-error" role="alert"><AlertTriangle size={15} /><span>{error}</span><button type="button" onClick={refreshQueue}>Refresh</button></div>}

          <section className="reply-queue-bar">
            <div className="reply-queue-label"><span className="reply-queue-icon"><MessageSquareText size={16} /></span><span><strong>Reply queue</strong><small>{tickets.length} ticket{tickets.length === 1 ? '' : 's'} awaiting support</small></span></div>
            <label htmlFor="reply-ticket-select">Select ticket</label>
            <div className="reply-select-wrap">
              <select id="reply-ticket-select" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setError(''); setNotice('') }} disabled={loading || tickets.length === 0}>
                {tickets.length === 0 ? <option value="">No open tickets</option> : tickets.map((item) => <option key={item._id} value={item._id}>#{ticketId(item)} · {item.subject}</option>)}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </div>
            {ticket?.status === 'escalated' && <span className="reply-escalated-label"><AlertTriangle size={13} /> Escalated</span>}
          </section>

          {loading ? (
            <div className="reply-empty-state" role="status"><span className="triage-spinner" /><p>Loading the approval queue…</p></div>
          ) : ticket ? (
            <div className="reply-split-screen">
              <CustomerConversation ticket={ticket} />
              <DraftComposer
                key={`${ticket._id}-${ticket.draftReply?.generatedAt || ''}-${ticket.draftReply?.editedAt || ''}`}
                ticket={ticket}
                providerConfigured={providerConfigured}
                busy={busy}
                onGenerate={generateDraft}
                onSave={saveDraft}
                onApprove={approveDraft}
                onEscalate={escalateTicket}
              />
            </div>
          ) : (
            <div className="reply-empty-state">
              <span className="reply-empty-icon"><Check size={19} /></span>
              <h2>{error ? 'Reply queue unavailable' : 'All caught up'}</h2>
              <p>{error ? 'Refresh the queue to retry. Your ticket data has not been changed.' : 'There are no open tickets waiting for a support reply.'}</p>
              {!error && <Link to={`/${user?.role}/triage`} className="reply-empty-link">Open AI Triage Center <ArrowRight size={14} /></Link>}
            </div>
          )}

          {ticket && (
            <footer className="triage-footer"><span>© 2026 NEXA Support Desk</span><span><ShieldCheck size={12} /> AI suggestions always require human approval</span></footer>
          )}
        </main>
      </div>
    </div>
  )
}
