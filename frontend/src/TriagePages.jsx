import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  AudioLines,
  Bell,
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
} from 'lucide-react'
import { roleDestination, roleLabels } from './auth-utils.js'
import { useAuth } from './useAuth.js'
import api from './api.js'
import './Triage.css'

const stages = [
  { title: 'Understanding', description: 'Reading customer context', icon: <FileText size={15} /> },
  { title: 'Classifying', description: 'Finding the right category', icon: <Target size={15} /> },
  { title: 'Prioritizing', description: 'Checking urgency and tone', icon: <Sparkles size={15} /> },
  { title: 'Assigning', description: 'Preparing a team recommendation', icon: <UserRoundCheck size={15} /> },
]

const niceLabel = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const ticketId = (ticket) => ticket?._id?.slice(-6).toUpperCase()

export function TriageSidebar({ user, onLogout, loggingOut, mobileOpen, onClose, activeView = 'triage' }) {
  return (
    <>
      {mobileOpen && <button className="triage-drawer-scrim" type="button" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`triage-sidebar${mobileOpen ? ' triage-sidebar-open' : ''}`}>
        <Link className="brand triage-brand" to="/" aria-label="NEXA home">
          <img className="brand-mark" src="/nexa-mark.svg" alt="" />
          <span className="brand-word">NEXA</span>
        </Link>
        <div className="triage-space-card">
          <span className="triage-space-logo"><Sparkles size={17} /></span>
          <span><strong>Support Desk</strong><small>AI operations</small></span>
          <ChevronDown size={14} />
        </div>
        <p className="triage-nav-label">WORKSPACE</p>
        <nav className="triage-nav" aria-label="Agent workspace navigation">
          {user?.role === 'customer' ? (
            <>
              <Link className={activeView === 'overview' ? 'active' : ''} to={roleDestination(user.role)} onClick={onClose}><LayoutDashboard size={16} /> Overview</Link>
              <Link className={activeView === 'chat' ? 'active' : ''} to="/customer/chat" onClick={onClose}><AudioLines size={16} /> Live Chat</Link>
            </>
          ) : (
            <>
              <Link className={activeView === 'overview' ? 'active' : ''} to={roleDestination(user?.role)} onClick={onClose}><LayoutDashboard size={16} /> Overview</Link>
              <Link className={activeView === 'chat' ? 'active' : ''} to={`/${user?.role}/chat`} onClick={onClose}><AudioLines size={16} /> Live Chat</Link>
              <Link className={activeView === 'triage' ? 'active' : ''} to={`/${user?.role}/triage`} onClick={onClose}><Sparkles size={16} /> AI Triage Center</Link>
              <Link className={activeView === 'draft' ? 'active' : ''} to={`/${user?.role}/draft-reply`} onClick={onClose}><Bot size={16} /> AI Draft Reply</Link>
              {['supervisor', 'admin'].includes(user?.role) && <Link className={activeView === 'analytics' ? 'active' : ''} to={`/${user.role}/analytics`} onClick={onClose}><BarChart3 size={16} /> Analytics</Link>}
            </>
          )}
          <Link className={activeView === 'notifications' ? 'active' : ''} to={`/${user?.role}/notifications`} onClick={onClose}><Bell size={16} /> Notifications</Link>
          <Link className={activeView === 'knowledge' ? 'active' : ''} to={`/${user?.role}/knowledge`} onClick={onClose}><BookOpen size={16} /> Knowledge Base</Link>
        </nav>
        <div className="triage-sidebar-bottom">
          <div className="triage-user-card">
            <span className="triage-user-avatar">{user?.fullName?.[0]?.toUpperCase() || 'N'}</span>
            <span><strong>{user?.fullName}</strong><small>{roleLabels[user?.role] || 'Support team'}</small></span>
          </div>
          <button className="triage-logout" type="button" onClick={onLogout} disabled={loggingOut}><LogOut size={15} /> {loggingOut ? 'Signing out…' : 'Sign out'}</button>
          <small className="triage-sidebar-version">NEXA DESK / OPERATIONS</small>
        </div>
      </aside>
    </>
  )
}

export function TriageTopbar({ user, onMenu, title = 'AI Triage Center' }) {
  return (
    <header className="triage-topbar">
      <button className="triage-menu-button" type="button" onClick={onMenu} aria-label="Open navigation"><Menu size={19} /></button>
      <div className="triage-breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{title}</strong></div>
      <div className="triage-top-user"><span className="triage-provider-live"><i /> SECURE</span><span className="triage-user-avatar">{user?.fullName?.[0]?.toUpperCase() || 'N'}</span></div>
    </header>
  )
}

function FlowSteps({ activeStage, complete, review }) {
  return (
    <ol className="triage-process" aria-label="Triage process">
      {stages.map((stage, index) => {
        const isDone = complete || index < activeStage
        const isActive = !complete && index === activeStage
        return (
          <li className={`triage-process-step${isDone ? ' process-done' : ''}${isActive ? ' process-active' : ''}${review && index === 3 ? ' process-review' : ''}`} key={stage.title}>
            <span className="process-icon">{isDone ? <Check size={15} /> : stage.icon}</span>
            <span className="process-copy"><strong>{stage.title}</strong><small>{isActive ? 'In progress…' : stage.description}</small></span>
            {index < stages.length - 1 && <span className="process-connector" />}
          </li>
        )
      })}
    </ol>
  )
}

function ConfidenceRing({ confidence, provider }) {
  const percentage = Math.round(confidence * 100)
  return (
    <div className={`triage-confidence${percentage < 80 || provider === 'rules' ? ' confidence-review' : ''}`} style={{ '--confidence': `${percentage}%` }} aria-label={`${provider === 'rules' ? 'Rule-match confidence' : 'AI confidence'} ${percentage}%`}>
      <div className="confidence-inner"><strong>{percentage}<small>%</small></strong><span>{provider === 'rules' ? 'RULE MATCH' : 'AI CONFIDENCE'}</span></div>
    </div>
  )
}

function TriageResult({ ticket }) {
  if (!ticket?.triage) return null
  const result = ticket.triage
  const isRules = result.provider === 'rules'
  return (
    <section className="triage-result-card" aria-live="polite">
      <div className="triage-result-heading">
        <div><p className="triage-kicker"><span /> ANALYSIS COMPLETE / {isRules ? 'LOCAL RULE PREVIEW' : 'AI PROVIDER'}</p><h2>Triage assessment</h2></div>
        <span className={`triage-result-state${result.reviewRequired ? ' needs-human' : ' ready-for-review'}`}>
          {result.reviewRequired ? <><AlertTriangle size={13} /> Human review required</> : <><Check size={13} /> AI recommendation ready</>}
        </span>
      </div>
      {isRules && <div className="triage-disclosure"><CircleHelp size={14} /><span>This result comes from local keyword rules, not an AI model. It is a preview only; a human must confirm all decisions.</span></div>}
      <div className="triage-result-grid">
        <div className="triage-result-fields">
          <div><span>Category</span><strong>{niceLabel(result.category)}</strong></div>
          <div><span>Priority</span><strong className={`result-priority priority-${result.priority}`}>{niceLabel(result.priority)}</strong></div>
          <div><span>Sentiment</span><strong className={`result-sentiment sentiment-${result.sentiment}`}>{niceLabel(result.sentiment)}</strong></div>
          <div><span>Recommended team</span><strong>{result.recommendedTeam}</strong></div>
        </div>
        <div className="triage-confidence-wrap">
          <ConfidenceRing confidence={result.confidence} provider={result.provider} />
          <span>{isRules ? 'Match score' : 'Model confidence'}</span>
        </div>
      </div>
      <div className="triage-rationale"><Sparkles size={14} /><p>{result.rationale}</p></div>
      {result.reviewRequired ? (
        <div className="triage-review-callout"><UserRoundCheck size={16} /><span><strong>Flagged for human review</strong><small>{isRules ? 'Local rules cannot assign tickets. Please review and route manually.' : 'Confidence is below 80%. The ticket has been escalated for a human decision.'}</small></span></div>
      ) : (
        <div className="triage-recommendation"><Check size={15} /><span><strong>Suggested assignment: {result.recommendedTeam}</strong><small>This is a recommendation only. Assignment still requires a human agent action.</small></span></div>
      )}
    </section>
  )
}

export function TriageCenterPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeStage, setActiveStage] = useState(-1)
  const [error, setError] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [notice, setNotice] = useState('')
  const [providerMode, setProviderMode] = useState('')

  const applyQueue = useCallback((data) => {
    setTickets(data.tickets)
    setProviderMode(data.provider)
    setSelectedId((current) => data.tickets.some((ticket) => ticket._id === current) ? current : data.tickets[0]?._id || '')
  }, [])

  const loadQueue = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const { data } = await api.get('/ai/triage/tickets')
      applyQueue(data)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load the triage queue. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [applyQueue])

  // The queue is fetched asynchronously; this effect owns that initial request.
  useEffect(() => {
    let active = true
    api.get('/ai/triage/tickets')
      .then(({ data }) => {
        if (active) applyQueue(data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load the triage queue. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [applyQueue])

  useEffect(() => {
    if (!submitting) return undefined
    const timer = window.setInterval(() => setActiveStage((stage) => Math.min(stage + 1, stages.length - 1)), 650)
    return () => window.clearInterval(timer)
  }, [submitting])

  const analyze = async () => {
    if (!selectedId || submitting) return
    setError('')
    setNotice('')
    setSubmitting(true)
    setActiveStage(0)
    try {
      const { data } = await api.post(`/ai/triage/tickets/${selectedId}/analyze`)
      setSelectedTicket(data.ticket)
      setTickets((current) => current.filter((ticket) => ticket._id !== selectedId))
      setNotice(data.ticket.triage.provider === 'rules'
        ? 'Local rules preview completed. No AI model was used and no ticket was assigned.'
        : 'AI analysis completed. The result was saved; assignments are never made automatically.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Triage could not be completed. No result was saved.')
    } finally {
      setSubmitting(false)
      setActiveStage(-1)
    }
  }

  const refreshQueue = () => {
    setError('')
    loadQueue(true)
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

  const queueTicket = tickets.find((ticket) => ticket._id === selectedId)
  const selectedResult = selectedTicket?.triage && selectedTicket._id === selectedId ? selectedTicket : null
  const displayedTicket = selectedResult || queueTicket
  const rulesMode = providerMode === 'rules'

  return (
    <div className="triage-app site-shell">
      <TriageSidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="triage-main">
        <TriageTopbar user={user} onMenu={() => setMobileOpen(true)} />
        <main className="triage-content">
          <div className="triage-page-title-row">
            <div><p className="triage-kicker"><span /> NEXA INTELLIGENCE / TICKET OPERATIONS</p><h1>AI Triage Center</h1><p>Understand, classify, and prioritize incoming support requests.</p></div>
            <button className="triage-refresh" type="button" onClick={refreshQueue} disabled={loading || refreshing}><RefreshCw size={14} className={refreshing ? 'is-refreshing' : ''} /> Refresh queue</button>
          </div>

          {providerMode && <div className={`triage-provider-banner${rulesMode ? '' : ' provider-ai-configured'}`}><CircleHelp size={15} /><p>{rulesMode ? <><strong>AI provider not configured.</strong> This workspace is using an explicitly labelled local keyword-rule preview. Results are not AI-generated and always require human review.</> : <><strong>AI provider connected.</strong> Ticket content is sent to the configured server-side provider for analysis. Review every suggestion before assigning.</>}</p></div>}
          {notice && <div className="triage-notice" role="status"><Check size={15} />{notice}</div>}
          {error && <div className="triage-error" role="alert"><AlertTriangle size={15} /><span>{error}</span><button type="button" onClick={refreshQueue}>Retry</button></div>}

          <section className="triage-flow-card">
            <div className="triage-section-title"><div><p className="triage-kicker"><span /> FOUR-STAGE WORKFLOW</p><h2>From request to the right team</h2></div><span className="workflow-live"><i /> READY</span></div>
            <FlowSteps activeStage={activeStage} complete={Boolean(selectedResult)} review={Boolean(selectedResult?.triage?.reviewRequired)} />
          </section>

          <div className="triage-work-grid">
            <section className="triage-queue-card">
              <div className="triage-section-title queue-title"><div><p className="triage-kicker"><span /> NEEDS TRIAGE</p><h2>Incoming tickets <span className="queue-count">{tickets.length}</span></h2></div><span className="queue-scope">Pending</span></div>
              {loading ? (
                <div className="triage-queue-state" role="status"><span className="triage-spinner" /><p>Loading untriaged tickets…</p></div>
              ) : tickets.length === 0 ? (
                <div className="triage-queue-state"><span className="triage-empty-icon"><Check size={18} /></span><h3>Queue is clear</h3><p>New pending tickets will appear here when they’re ready for triage.</p></div>
              ) : (
                <div className="triage-queue-list">
                  {tickets.map((ticket) => (
                    <button className={`triage-queue-item${selectedId === ticket._id ? ' selected' : ''}`} type="button" key={ticket._id} onClick={() => { setSelectedId(ticket._id); setError('') }}>
                      <span className={`queue-priority-dot queue-priority-${ticket.priority}`} />
                      <span className="queue-ticket-copy"><strong>{ticket.subject}</strong><small>#{ticketId(ticket)} · {ticket.customer?.fullName || 'Customer'}</small><span>{niceLabel(ticket.category)} <i>·</i> {niceLabel(ticket.priority)} priority</span></span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="triage-analysis-card">
              <div className="triage-section-title analysis-title"><div><p className="triage-kicker"><span /> TICKET CONTEXT</p><h2>{displayedTicket ? `#${ticketId(displayedTicket)}` : 'Select a ticket'}</h2></div><span className="analysis-bot"><Bot size={17} /></span></div>
              {displayedTicket ? (
                <>
                  <div className="analysis-subject"><h3>{displayedTicket.subject}</h3><span><Clock3 size={12} /> {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(displayedTicket.createdAt))}</span></div>
                  <div className="analysis-message"><div><span className="customer-message-avatar">{displayedTicket.customer?.fullName?.[0]?.toUpperCase() || 'C'}</span><span><strong>{displayedTicket.customer?.fullName || 'Customer'}</strong><small>Customer message</small></span></div><p>{displayedTicket.description}</p></div>
                  {!selectedResult ? (
                    <div className="triage-run-action">
                      <div><ShieldCheck size={14} /><span>{rulesMode ? 'No external AI provider is configured.' : 'Analysis runs through the configured AI provider.'}</span></div>
                      <button className="button button-primary" type="button" onClick={analyze} disabled={submitting}>{submitting ? <><AudioLines size={15} /> Analyzing…</> : <><Sparkles size={15} /> Analyze ticket <ArrowRight size={14} /></>}</button>
                    </div>
                  ) : (
                    <div className="triage-complete-strip"><Check size={14} /><span>Assessment saved · {selectedResult.triage.provider === 'rules' ? 'local rule preview' : 'AI provider'}</span><span>{new Date(selectedResult.triage.analyzedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div>
                  )}
                </>
              ) : (
                <div className="triage-no-selection"><span><ArrowDown size={16} /></span><p>Select a ticket from the incoming queue to review its message and start triage.</p></div>
              )}
            </section>
          </div>

          {selectedResult && <TriageResult ticket={selectedResult} />}

          <footer className="triage-footer"><span>© 2026 NEXA Support Desk</span><span><ShieldCheck size={12} /> Human oversight stays in control</span></footer>
        </main>
      </div>
    </div>
  )
}
