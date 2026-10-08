import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, AlertTriangle, ArrowRight, Bell, BookOpen, Bot, Check, ChevronRight, CircleHelp,
  Clock3, FileText, LayoutDashboard, LockKeyhole, LogOut, Menu, Search, Settings, Shield,
  ShieldCheck, Ticket, Users, UserCog, X,
} from 'lucide-react'
import { useAuth } from './useAuth.js'
import api from './api.js'
import './AdminConsole.css'

const navItems = [
  { path: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/users', label: 'Users & Agents', icon: Users },
  { path: '/admin/tickets', label: 'Ticket Management', icon: Ticket },
  { path: '/admin/config', label: 'AI Configuration', icon: Bot },
  { path: '/admin/permissions', label: 'Roles & Permissions', icon: ShieldCheck },
  { path: '/admin/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { path: '/admin/analytics', label: 'Analytics', icon: Activity },
  { path: '/admin/audit-logs', label: 'Audit Logs', icon: FileText },
  { path: '/admin/notifications', label: 'Notifications', icon: Bell },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
]

const sectionTitles = {
  '/admin/dashboard': ['Control center', 'Admin dashboard'],
  '/admin/users': ['Workspace access', 'Users & agents'],
  '/admin/tickets': ['Support operations', 'Ticket management'],
  '/admin/config': ['Intelligence services', 'AI configuration'],
  '/admin/permissions': ['Access control', 'Roles & permissions'],
  '/admin/audit-logs': ['Workspace activity', 'Audit logs'],
  '/admin/settings': ['Workspace preferences', 'Settings'],
}

const roleNames = { customer: 'Customer', agent: 'Agent', supervisor: 'Supervisor', admin: 'Admin' }
const statusNames = {
  pending: 'Pending',
  ai_processing: 'AI Processing',
  assigned_to_agent: 'Assigned',
  resolved: 'Resolved',
  escalated: 'Escalated',
  closed: 'Closed',
}

function dateLabel(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function useAdminData(section) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadedSection, setLoadedSection] = useState('')
  useEffect(() => {
    let active = true
    const paths = {
        '/admin/dashboard': '/admin/overview',
        '/admin/users': '/admin/users',
        '/admin/tickets': '/admin/tickets',
        '/admin/config': '/admin/overview',
        '/admin/permissions': '/admin/permissions',
        '/admin/audit-logs': '/admin/audit-logs',
        '/admin/settings': '/admin/settings',
    }
    api.get(paths[section] || '/admin/overview')
      .then(({ data: result }) => {
        if (active) {
          setData(result)
          setError('')
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load this admin workspace.')
      })
      .finally(() => {
        if (active) {
          setLoadedSection(section)
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [section, refreshKey])
  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setRefreshKey((current) => current + 1)
  }, [])
  return { data, setData, loading: loading || loadedSection !== section, error, reload, setError }
}

function AdminSidebar({ active, user, onLogout, loggingOut, mobileOpen, onClose }) {
  return (
    <>
      {mobileOpen && <button className="admin-drawer-scrim" type="button" onClick={onClose} aria-label="Close admin navigation" />}
      <aside className={`admin-sidebar${mobileOpen ? ' admin-sidebar-open' : ''}`}>
        <Link to="/" className="brand admin-brand" aria-label="NEXA home" onClick={onClose}>
          <img className="brand-mark" src="/nexa-mark.svg" alt="" /><span className="brand-word">NEXA</span>
        </Link>
        <div className="admin-workspace"><span className="admin-workspace-icon"><Shield size={15} /></span><span><strong>Workspace Admin</strong><small>System control center</small></span><ChevronRight size={14} /></div>
        <p className="admin-nav-label">ADMINISTRATION</p>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path} className={active === path ? 'active' : ''} aria-label={label} title={label} onClick={onClose}>
              <Icon size={15} /><span>{label}</span>{active === path && <span className="admin-nav-indicator" />}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-profile"><span>{user?.fullName?.slice(0, 1).toUpperCase() || 'A'}</span><div><strong>{user?.fullName || 'Administrator'}</strong><small>Workspace admin</small></div></div>
          <button type="button" className="admin-logout" onClick={onLogout} disabled={loggingOut}><LogOut size={14} />{loggingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>
    </>
  )
}

function MetricCard({ label, value, detail, icon: Icon, tone }) {
  return <article className={`admin-metric admin-metric-${tone}`}><span className="admin-metric-icon"><Icon size={17} /></span><p>{label}</p><strong>{value ?? '—'}</strong><small>{detail}</small></article>
}

function LoadingState() {
  return <div className="admin-state" role="status"><span className="loading-ring" /><p>Loading secure workspace…</p></div>
}

function ErrorState({ error, onRetry }) {
  return <div className="admin-error" role="alert"><AlertTriangle size={16} /><span>{error}</span><button type="button" onClick={onRetry}>Retry</button></div>
}

function Overview({ data }) {
  const roleCount = Object.fromEntries((data.usersByRole || []).map(({ _id, total }) => [_id, total]))
  const statusCount = Object.fromEntries((data.ticketsByStatus || []).map(({ _id, total }) => [_id, total]))
  return (
    <>
      <div className="admin-metrics">
        <MetricCard label="Total users" value={data.users} detail={`${data.activeUsers || 0} active accounts`} icon={Users} tone="blue" />
        <MetricCard label="Support team" value={(roleCount.agent || 0) + (roleCount.supervisor || 0)} detail={`${roleCount.supervisor || 0} supervisors`} icon={UserCog} tone="purple" />
        <MetricCard label="All tickets" value={data.tickets} detail={`${statusCount.pending || 0} awaiting action`} icon={Ticket} tone="cyan" />
        <MetricCard label="Knowledge articles" value={data.articles} detail="Published workspace library" icon={BookOpen} tone="pink" />
      </div>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <header className="admin-panel-heading"><div><p className="admin-eyebrow">WORKSPACE HEALTH</p><h2>System snapshot</h2></div><span className="admin-live"><i /> LIVE DATA</span></header>
          <div className="admin-snapshot-list">
            {[
              ['Open tickets', (statusCount.pending || 0) + (statusCount.ai_processing || 0) + (statusCount.assigned_to_agent || 0) + (statusCount.escalated || 0), Ticket],
              ['Resolved requests', (statusCount.resolved || 0) + (statusCount.closed || 0), Check],
              ['Active administrators', roleCount.admin || 0, ShieldCheck],
            ].map(([label, value, Icon]) => <div key={label}><span><Icon size={14} />{label}</span><strong>{value}</strong></div>)}
          </div>
          <div className="admin-quick-links">
            <Link to="/admin/users">Manage workspace access <ArrowRight size={13} /></Link>
            <Link to="/admin/tickets">Review support tickets <ArrowRight size={13} /></Link>
          </div>
        </section>
        <section className="admin-panel">
          <header className="admin-panel-heading"><div><p className="admin-eyebrow">PROVIDER STATUS</p><h2>AI services</h2></div><Link to="/admin/config" className="admin-subtle-link">Details <ArrowRight size={12} /></Link></header>
          <ProviderRows providers={data.aiProviders} />
          <div className="admin-readonly-note"><LockKeyhole size={13} /><span>Provider credentials are deployment-managed and never exposed in this console.</span></div>
        </section>
      </div>
      <section className="admin-panel admin-activity-panel">
        <header className="admin-panel-heading"><div><p className="admin-eyebrow">RECENT CHANGES</p><h2>Admin activity</h2></div><Link to="/admin/audit-logs" className="admin-subtle-link">View audit log <ArrowRight size={12} /></Link></header>
        <ActivityRows rows={data.latestActivity || []} />
      </section>
    </>
  )
}

function ProviderRows({ providers = {} }) {
  const rows = [
    ['Ticket triage', providers.triage === 'connected' ? 'Connected AI provider' : 'Local rules provider', providers.triage === 'connected' ? 'connected' : 'limited'],
    ['Reply drafting', providers.replyDraft === 'connected' ? 'Connected AI provider' : 'Not configured', providers.replyDraft === 'connected' ? 'connected' : 'unconfigured'],
    ['Knowledge answers', providers.knowledgeAnswers === 'connected' ? 'Connected answer provider' : 'Retrieval only · no LLM', providers.knowledgeAnswers === 'connected' ? 'connected' : 'unconfigured'],
  ]
  return <div className="admin-provider-list">{rows.map(([label, detail, state]) => <div className="admin-provider-row" key={label}><span className={`admin-provider-dot ${state}`} /><span><strong>{label}</strong><small>{detail}</small></span><span className={`admin-provider-badge ${state}`}>{state === 'connected' ? 'Active' : state === 'limited' ? 'Rules' : 'Offline'}</span></div>)}</div>
}

function ActivityRows({ rows = [] }) {
  if (!rows.length) return <div className="admin-empty-inline"><Clock3 size={15} /><span>No administrative changes have been recorded yet.</span></div>
  return <div className="admin-activity-list">{rows.map((row) => <div key={row._id}><span className="admin-activity-icon"><Activity size={13} /></span><span className="admin-activity-copy"><strong>{row.summary}</strong><small>{row.actor?.fullName || 'Administrator'} · {dateLabel(row.createdAt)}</small></span><span className="admin-action-tag">{row.action}</span></div>)}</div>
}

function UsersSection({ data, reload, setError, user }) {
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const users = useMemo(() => (data?.users || []).filter((item) =>
    `${item.fullName} ${item.email}`.toLowerCase().includes(search.toLowerCase()),
  ), [data, search])
  const updateUser = async (target, updates) => {
    setBusyId(target._id)
    setNotice('')
    setError('')
    try {
      await api.patch(`/admin/users/${target._id}`, updates)
      setNotice(`Updated access for ${target.fullName}.`)
      await reload()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this account.')
    } finally {
      setBusyId('')
    }
  }
  return (
    <section className="admin-panel admin-table-panel">
      <header className="admin-panel-heading"><div><p className="admin-eyebrow">ACCOUNT DIRECTORY</p><h2>Users & agents <span className="admin-count">{data?.users?.length || 0}</span></h2></div><label className="admin-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" aria-label="Search users" /></label></header>
      {notice && <p className="admin-success" role="status"><Check size={13} />{notice}</p>}
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th><th>Access</th></tr></thead><tbody>
        {users.map((target) => <tr key={target._id}>
          <td data-label="Member"><div className="admin-member"><span>{target.fullName?.slice(0, 1).toUpperCase()}</span><div><strong>{target.fullName}</strong><small>{target.email}</small></div></div></td>
          <td data-label="Role"><select aria-label={`Role for ${target.fullName}`} value={target.role} disabled={busyId === target._id || target._id === user?.id} onChange={(event) => updateUser(target, { role: event.target.value })}>{Object.entries(roleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
          <td data-label="Status"><span className={`admin-status-pill ${target.isActive ? 'active' : 'inactive'}`}><i />{target.isActive ? 'Active' : 'Inactive'}</span></td>
          <td data-label="Joined" className="admin-date">{dateLabel(target.createdAt)}</td>
          <td data-label="Access"><button type="button" className={`admin-row-button${target.isActive ? ' danger' : ''}`} disabled={busyId === target._id || target._id === user?.id} onClick={() => updateUser(target, { isActive: !target.isActive })}>{busyId === target._id ? 'Saving…' : target.isActive ? 'Deactivate' : 'Activate'}</button></td>
        </tr>)}
        {!users.length && <tr><td colSpan="5"><div className="admin-empty-inline">No matching workspace members.</div></td></tr>}
      </tbody></table></div>
      <p className="admin-table-foot"><ShieldCheck size={12} /> Role and account changes are enforced by the API and recorded in the audit log.</p>
    </section>
  )
}

function TicketsSection({ data, reload, setError }) {
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const tickets = useMemo(() => (data?.tickets || []).filter((item) =>
    `${item.subject} ${item.customer?.fullName || ''} ${item._id}`.toLowerCase().includes(search.toLowerCase()),
  ), [data, search])
  const updateDraft = (ticket, key, value) => setDrafts((current) => ({
    ...current, [ticket._id]: { ...current[ticket._id], [key]: value },
  }))
  const saveTicket = async (ticket) => {
    const draft = drafts[ticket._id]
    if (!draft) return
    setBusyId(ticket._id)
    setNotice('')
    setError('')
    try {
      await api.patch(`/admin/tickets/${ticket._id}`, {
        status: draft.status ?? ticket.status,
        priority: draft.priority ?? ticket.priority,
        assignedAgent: draft.assignedAgent === undefined ? ticket.assignedAgent?._id || null : draft.assignedAgent || null,
      })
      setDrafts((current) => { const next = { ...current }; delete next[ticket._id]; return next })
      setNotice(`Updated ticket #${ticket._id.slice(-6).toUpperCase()}.`)
      await reload()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this ticket.')
    } finally {
      setBusyId('')
    }
  }
  return (
    <section className="admin-panel admin-table-panel">
      <header className="admin-panel-heading"><div><p className="admin-eyebrow">GLOBAL SUPPORT QUEUE</p><h2>All tickets <span className="admin-count">{data?.tickets?.length || 0}</span></h2></div><label className="admin-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets or customers" aria-label="Search tickets" /></label></header>
      {notice && <p className="admin-success" role="status"><Check size={13} />{notice}</p>}
      <div className="admin-table-scroll"><table className="admin-table admin-ticket-table"><thead><tr><th>Ticket</th><th>Customer</th><th>Priority</th><th>Status</th><th>Assigned to</th><th /></tr></thead><tbody>
        {tickets.map((ticket) => {
          const draft = drafts[ticket._id] || {}
          return <tr key={ticket._id}>
            <td data-label="Ticket"><div className="admin-ticket-cell"><strong>{ticket.subject}</strong><small>#{ticket._id.slice(-6).toUpperCase()} · {ticket.category} · {dateLabel(ticket.updatedAt)}</small></div></td>
            <td data-label="Customer"><div className="admin-ticket-cell"><strong>{ticket.customer?.fullName || 'Unknown'}</strong><small>{ticket.customer?.email || ''}</small></div></td>
            <td data-label="Priority"><select aria-label={`Priority for ${ticket.subject}`} value={draft.priority ?? ticket.priority} onChange={(event) => updateDraft(ticket, 'priority', event.target.value)}>{['critical', 'high', 'medium', 'low'].map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></td>
            <td data-label="Status"><select aria-label={`Status for ${ticket.subject}`} value={draft.status ?? ticket.status} onChange={(event) => updateDraft(ticket, 'status', event.target.value)}>{Object.entries(statusNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
            <td data-label="Assigned to"><select aria-label={`Assignee for ${ticket.subject}`} value={draft.assignedAgent ?? ticket.assignedAgent?._id ?? ''} onChange={(event) => updateDraft(ticket, 'assignedAgent', event.target.value)}><option value="">Unassigned</option>{(data.agents || []).map((agent) => <option key={agent._id} value={agent._id}>{agent.fullName} · {roleNames[agent.role]}</option>)}</select></td>
            <td data-label="Save"><button type="button" className="admin-save-button" disabled={busyId === ticket._id || !drafts[ticket._id]} onClick={() => saveTicket(ticket)}>{busyId === ticket._id ? 'Saving…' : 'Save'}</button></td>
          </tr>
        })}
        {!tickets.length && <tr><td colSpan="6"><div className="admin-empty-inline">No matching tickets found.</div></td></tr>}
      </tbody></table></div>
      <p className="admin-table-foot"><ShieldCheck size={12} /> Ticket changes are validated, emitted to live conversations, and recorded in the audit log.</p>
    </section>
  )
}

function PermissionsSection({ data }) {
  return <section className="admin-panel">
    <header className="admin-panel-heading"><div><p className="admin-eyebrow">SERVER-ENFORCED ACCESS</p><h2>Role permissions</h2></div><span className="admin-live"><LockKeyhole size={11} /> API CONTROLLED</span></header>
    <p className="admin-section-intro">Permissions are assigned from the authenticated account role. This reference is read-only; no permission can be granted from client-side role selection.</p>
    <div className="admin-role-grid">{(data.roles || []).map((item) => <article className="admin-role-card" key={item.role}><header><span><ShieldCheck size={15} /></span><strong>{roleNames[item.role]}</strong></header><ul>{item.permissions.map((permission) => <li key={permission}><Check size={12} />{permission}</li>)}</ul></article>)}</div>
  </section>
}

function AuditSection({ rows }) {
  return <section className="admin-panel admin-audit-panel">
    <header className="admin-panel-heading"><div><p className="admin-eyebrow">IMMUTABLE ACTIVITY TRAIL</p><h2>Audit history</h2></div><span className="admin-live"><i /> LATEST 100</span></header>
    <p className="admin-section-intro">Administrative role, account, ticket, and workspace setting changes are attributed to the signed-in administrator.</p>
    <ActivityRows rows={rows || []} />
  </section>
}

function SettingsSection({ data, reload, setError }) {
  const [form, setForm] = useState(data.settings)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.patch('/admin/settings', form)
      setNotice('Workspace settings saved.')
      await reload()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save workspace settings.')
    } finally {
      setSaving(false)
    }
  }
  return <div className="admin-settings-grid">
    <section className="admin-panel">
      <header className="admin-panel-heading"><div><p className="admin-eyebrow">WORKSPACE IDENTITY</p><h2>General settings</h2></div><Settings size={16} /></header>
      <form className="admin-settings-form" onSubmit={save}>
        <label>Workspace name<input required minLength={2} maxLength={80} value={form.workspaceName} onChange={(event) => setForm({ ...form, workspaceName: event.target.value })} /></label>
        <label>Support contact email<input type="email" required maxLength={254} value={form.supportEmail} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} /></label>
        {notice && <p className="admin-success" role="status"><Check size={13} />{notice}</p>}
        <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save workspace settings'} <ArrowRight size={13} /></button>
      </form>
    </section>
    <section className="admin-panel">
      <header className="admin-panel-heading"><div><p className="admin-eyebrow">SECURITY POSTURE</p><h2>Platform settings</h2></div><ShieldCheck size={16} /></header>
      <div className="admin-security-list">
        <div><span><LockKeyhole size={14} />Authentication</span><strong>HttpOnly session · role checked on API</strong></div>
        <div><span><Activity size={14} />Change history</span><strong>Admin operations audited</strong></div>
        <div><span><Bot size={14} />AI credentials</span><strong>Managed through deployment secrets</strong></div>
      </div>
      <p className="admin-readonly-note"><CircleHelp size={13} /> Secrets and provider URLs are never editable or displayed in the browser. Configure them in the backend environment and restart the service.</p>
    </section>
  </div>
}

function ConfigSection({ data }) {
  return <div className="admin-settings-grid">
    <section className="admin-panel">
      <header className="admin-panel-heading"><div><p className="admin-eyebrow">SERVICE CONNECTIVITY</p><h2>AI configuration</h2></div><Bot size={17} /></header>
      <ProviderRows providers={data.aiProviders} />
      <p className="admin-readonly-note"><LockKeyhole size={13} /> Configuration state only. No credentials, provider URLs, or customer content are exposed here.</p>
    </section>
    <section className="admin-panel">
      <header className="admin-panel-heading"><div><p className="admin-eyebrow">DEPLOYMENT CONTROLLED</p><h2>Connect a provider</h2></div><ShieldCheck size={16} /></header>
      <div className="admin-config-copy"><p>AI endpoints and credentials are supplied through backend environment variables. This keeps secrets out of browser sessions and audit records.</p><code>AI_TRIAGE_URL · AI_TRIAGE_API_KEY</code><code>AI_DRAFT_URL · AI_DRAFT_API_KEY</code><p>When a provider is not configured, NEXA reports rules-based triage or unconfigured drafting explicitly; it does not simulate generated AI results.</p></div>
    </section>
  </div>
}

export function AdminConsole({ section: requestedSection }) {
  const location = useLocation()
  const navigate = useNavigate()
  const section = requestedSection || location.pathname
  const { user, logout } = useAuth()
  const { data, loading, error, reload, setError } = useAdminData(section)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [message, title] = sectionTitles[section] || ['Workspace', 'Admin console']

  useEffect(() => {
    if (!mobileNavOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileNavOpen])

  const handleLogout = async () => {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (requestError) {
      setLogoutError(requestError.response?.data?.message || 'Unable to sign out because the API is unreachable.')
      setLoggingOut(false)
    }
  }

  const body = () => {
    if (loading) return <LoadingState />
    if (error) return <ErrorState error={error} onRetry={reload} />
    if (!data) return null
    if (section === '/admin/dashboard') return <Overview data={data} />
    if (section === '/admin/users') return <UsersSection data={data} reload={reload} setError={setError} user={user} />
    if (section === '/admin/tickets') return <TicketsSection data={data} reload={reload} setError={setError} />
    if (section === '/admin/config') return <ConfigSection data={data} />
    if (section === '/admin/permissions') return <PermissionsSection data={data} />
    if (section === '/admin/audit-logs') return <AuditSection rows={data.logs} />
    if (section === '/admin/settings') return <SettingsSection data={data} reload={reload} setError={setError} />
    return null
  }

  return (
    <div className="admin-app">
      <AdminSidebar active={section} user={user} onLogout={handleLogout} loggingOut={loggingOut} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="admin-main">
        <header className="admin-topbar"><button className="admin-menu-button" type="button" aria-label={mobileNavOpen ? 'Close admin navigation' : 'Open admin navigation'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? <X size={17} /> : <Menu size={17} />}</button><div><span className="admin-breadcrumb">NEXA <ChevronRight size={12} /> ADMIN <ChevronRight size={12} /></span><strong>{title}</strong></div><div className="admin-top-actions"><span className="admin-secure-badge"><LockKeyhole size={12} /> Secure workspace</span><span className="admin-avatar">{user?.fullName?.slice(0, 1).toUpperCase() || 'A'}</span></div></header>
        <main className="admin-content">
          <div className="admin-page-heading"><div><p className="admin-eyebrow"><i /> {message.toUpperCase()}</p><h1>{title}</h1><p>Manage NEXA access, support operations, and workspace health.</p></div>{section === '/admin/dashboard' && <button className="admin-refresh-button" type="button" onClick={reload}><Activity size={14} /> Refresh data</button>}</div>
          {logoutError && <div className="admin-error" role="alert"><AlertTriangle size={15} />{logoutError}</div>}
          {body()}
          <footer className="admin-footer"><span>© 2026 NEXA Support Desk</span><span>AI-Powered. Human-Centered. Always On.</span></footer>
        </main>
      </div>
    </div>
  )
}
