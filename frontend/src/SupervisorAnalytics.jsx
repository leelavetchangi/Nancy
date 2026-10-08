import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Check,
  Clock3,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Star,
  Ticket,
  UsersRound,
} from 'lucide-react'
import { useAuth } from './useAuth.js'
import { TriageSidebar, TriageTopbar } from './TriagePages.jsx'
import api from './api.js'
import './SupervisorAnalytics.css'

const dateLabel = (value, options = { month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en', options).format(new Date(`${value}T00:00:00Z`))

function useAnalytics(days) {
  const [result, setResult] = useState({ days: null, report: null, error: '' })
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let active = true
    api.get(`/analytics?days=${days}`)
      .then(({ data }) => { if (active) setResult({ days, report: data.analytics, error: '' }) })
      .catch((requestError) => {
        if (active) setResult({
          days,
          report: null,
          error: requestError.response?.data?.message || 'Unable to load analytics. Please try again.',
        })
      })
    return () => { active = false }
  }, [days])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const { data } = await api.get(`/analytics?days=${days}`)
      setResult({ days, report: data.analytics, error: '' })
    } catch (requestError) {
      setResult({
        days,
        report: null,
        error: requestError.response?.data?.message || 'Unable to load analytics. Please try again.',
      })
    } finally {
      setRefreshing(false)
    }
  }, [days])

  return {
    report: result.days === days ? result.report : null,
    loading: result.days !== days,
    refreshing,
    error: result.days === days ? result.error : '',
    refresh,
  }
}

function ChartFrame({ title, subtitle, icon: Icon, children, className = '' }) {
  return (
    <section className={`analytics-chart-card ${className}`}>
      <header className="analytics-chart-heading">
        <span className="analytics-chart-icon"><Icon size={15} /></span>
        <span><strong>{title}</strong><small>{subtitle}</small></span>
      </header>
      {children}
    </section>
  )
}

function ChartLegend({ items }) {
  return <div className="analytics-chart-legend">{items.map((item) => <span key={item.label}><i className={`legend-${item.color}`} />{item.label}</span>)}</div>
}

function LineChart({ data, series, formatValue = (value) => String(value), emptyMessage = 'No records in this period.' }) {
  const width = 560
  const height = 202
  const padding = { left: 42, right: 12, top: 16, bottom: 34 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const allValues = data.flatMap((item) => series.map((entry) => item[entry.key]).filter((value) => value !== null && value !== undefined))
  if (!allValues.length) return <div className="analytics-chart-empty">{emptyMessage}</div>
  const maximum = Math.max(...allValues, 1)
  const scaleMaximum = series[0]?.key.includes('Rate') || series[0]?.key === 'csat' ? (series[0]?.key === 'csat' ? 5 : 100) : Math.ceil(maximum * 1.15 / 5) * 5 || 5
  const xAt = (index) => padding.left + (data.length < 2 ? plotWidth / 2 : index * plotWidth / (data.length - 1))
  const yAt = (value) => padding.top + plotHeight - (value / scaleMaximum) * plotHeight
  const labelIndexes = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])
  const ticks = [0, scaleMaximum / 2, scaleMaximum]

  return (
    <div className="analytics-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${series.map((item) => item.label).join(' and ')} over time`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={yAt(tick)} y2={yAt(tick)} className="chart-gridline" />
            <text x={padding.left - 7} y={yAt(tick) + 3} textAnchor="end" className="chart-axis-label">{formatValue(tick)}</text>
          </g>
        ))}
        {data.map((item, index) => labelIndexes.has(index) && (
          <text key={item.date} x={xAt(index)} y={height - 10} textAnchor="middle" className="chart-axis-label">{dateLabel(item.date)}</text>
        ))}
        {series.map((entry) => {
          const points = data.map((item, index) => item[entry.key] == null ? null : `${xAt(index)},${yAt(item[entry.key])}`).filter(Boolean)
          const path = points.reduce((segments, point, index) => `${segments}${index ? ' L' : 'M'}${point}`, '')
          return (
            <g key={entry.key}>
              {points.length > 1 && <path d={path} pathLength={1} className={`chart-line line-${entry.color}`} />}
              {data.map((item, index) => item[entry.key] == null ? null : (
                <circle
                  key={`${entry.key}-${item.date}`}
                  cx={xAt(index)}
                  cy={yAt(item[entry.key])}
                  r="3.2"
                  className={`chart-point point-${entry.color}`}
                  style={{ '--chart-point-index': index }}
                >
                  <title>{`${dateLabel(item.date)} · ${entry.label}: ${formatValue(item[entry.key])}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
      <ChartLegend items={series} />
    </div>
  )
}

function ResolutionDonut({ ai, human, total }) {
  if (!total) return <div className="analytics-chart-empty">No resolved tickets in this period.</div>
  const radius = 49
  const circumference = 2 * Math.PI * radius
  const aiLength = (ai / total) * circumference
  return (
    <div className="analytics-donut-layout">
      <svg className="analytics-donut" viewBox="0 0 140 140" role="img" aria-label={`AI-assisted resolutions ${ai}; human resolutions ${human}`}>
        <circle cx="70" cy="70" r={radius} className="donut-track" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          className="donut-human"
          strokeDasharray={`${circumference - aiLength} ${circumference}`}
          strokeDashoffset={-aiLength}
          style={{ '--donut-start': 0, '--donut-end': -aiLength }}
          transform="rotate(-90 70 70)"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          className="donut-ai"
          strokeDasharray={`${aiLength} ${circumference}`}
          style={{ '--donut-start': circumference, '--donut-end': 0 }}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="67" textAnchor="middle" className="donut-total">{total}</text>
        <text x="70" y="83" textAnchor="middle" className="donut-caption">RESOLVED</text>
      </svg>
      <div className="analytics-donut-legend">
        <span><i className="legend-blue" /><small>AI-assisted</small><strong>{ai}</strong></span>
        <span><i className="legend-purple" /><small>Human-led</small><strong>{human}</strong></span>
      </div>
    </div>
  )
}

function CategoryBars({ categories }) {
  if (!categories.length) return <div className="analytics-chart-empty">No ticket categories in this period.</div>
  const maximum = Math.max(...categories.map((item) => item.tickets), 1)
  return (
    <div className="analytics-category-list">
      {categories.map((item, index) => (
        <div className="analytics-category-row" key={item.category} style={{ '--category-index': index }}>
          <span>{item.category.replaceAll('_', ' ')}</span>
          <div><i style={{ width: `${Math.max(4, item.tickets / maximum * 100)}%`, '--category-index': index }} /></div>
          <strong>{item.tickets}</strong>
        </div>
      ))}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <article className={`analytics-metric-card metric-${tone}`}>
      <span className="analytics-metric-icon"><Icon size={16} /></span>
      <span className="analytics-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

export function SupervisorAnalytics() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [days, setDays] = useState(30)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const { report, loading, refreshing, error, refresh } = useAnalytics(days)
  const summary = report?.summary
  const responded = summary?.responseCount || 0
  const ratings = summary?.csatResponses || 0
  const responseLabel = summary?.averageResponseMinutes == null ? '—' : `${summary.averageResponseMinutes} min`
  const ratingLabel = summary?.customerSatisfaction == null ? '—' : `${summary.customerSatisfaction.toFixed(1)} / 5`
  const chartData = report?.daily || []
  const rangeLabel = report?.range ? `${dateLabel(report.range.start)} – ${dateLabel(report.range.end, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (requestError) {
      setLogoutError(requestError.response?.data?.message || 'Unable to sign out because the API is unreachable.')
      setLoggingOut(false)
    }
  }

  return (
    <div className="triage-app site-shell supervisor-analytics">
      <TriageSidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} activeView={location.pathname.endsWith('/dashboard') ? 'overview' : 'analytics'} />
      <div className="triage-main">
        <TriageTopbar user={user} onMenu={() => setMobileOpen(true)} title="Supervisor Analytics" />
        <main className="triage-content analytics-content">
          <div className="triage-page-title-row analytics-title-row">
            <div><p className="triage-kicker"><span /> NEXA INTELLIGENCE / OPERATIONS INSIGHTS</p><h1>Supervisor Analytics</h1><p>Real support performance from ticket, conversation, and survey data.</p></div>
            <div className="analytics-toolbar">
              <label className="analytics-range"><span>Period</span><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
              <button className="triage-refresh" type="button" onClick={refresh} disabled={loading || refreshing}><RefreshCw size={14} className={refreshing ? 'is-refreshing' : ''} /> Refresh</button>
            </div>
          </div>

          {error && <div className="triage-error" role="alert"><AlertTriangle size={15} /><span>{error}</span><button type="button" onClick={refresh}>Retry</button></div>}
          {logoutError && <div className="triage-error" role="alert"><AlertTriangle size={15} /><span>{logoutError}</span></div>}
          {report && <div className="analytics-data-note" role="status"><Activity size={13} /><span>MongoDB ticket cohort · {rangeLabel} · {summary.totalTickets.toLocaleString()} tickets</span></div>}

          <section className="analytics-metrics" aria-label="Support performance summary">
            <MetricCard icon={Bot} label="AI Resolution Rate" value={loading || !summary ? '—' : `${summary.aiResolutionRate}%`} detail={summary ? `${summary.aiResolvedTickets} AI-assisted resolved` : 'Analytics unavailable'} tone="blue" />
            <MetricCard icon={UsersRound} label="Human Resolution Rate" value={loading || !summary ? '—' : `${summary.humanResolutionRate}%`} detail={summary ? `${summary.humanResolvedTickets} human-led resolved` : 'Analytics unavailable'} tone="purple" />
            <MetricCard icon={Clock3} label="Average Response" value={loading ? '—' : responseLabel} detail={responded ? `From ${responded.toLocaleString()} first replies` : 'No first replies recorded'} tone="cyan" />
            <MetricCard icon={Star} label="Customer Satisfaction" value={loading ? '—' : ratingLabel} detail={ratings ? `From ${ratings.toLocaleString()} survey responses` : 'Awaiting survey responses'} tone="amber" />
          </section>

          {loading ? (
            <div className="agent-loading-state" role="status"><span className="triage-spinner" /><p>Calculating MongoDB analytics…</p></div>
          ) : report && (
            <div className="analytics-chart-grid">
              <ChartFrame title="AI vs Human Resolution" subtitle="Completed ticket handling" icon={Bot} className="analytics-resolution-card">
                <ResolutionDonut ai={summary.aiResolvedTickets} human={summary.humanResolvedTickets} total={summary.resolvedTickets} />
              </ChartFrame>
              <ChartFrame title="Tickets per Day" subtitle="Created tickets and resolved tickets by creation cohort" icon={Ticket}>
                <LineChart data={chartData} series={[{ key: 'tickets', label: 'Created', color: 'blue' }, { key: 'resolved', label: 'Resolved', color: 'purple' }]} />
              </ChartFrame>
              <ChartFrame title="Resolution Rate" subtitle="Resolved or closed tickets by creation day" icon={Check}>
                <LineChart data={chartData} series={[{ key: 'resolutionRate', label: 'Resolution rate', color: 'green' }]} formatValue={(value) => `${value}%`} />
              </ChartFrame>
              <ChartFrame title="Average Response Time" subtitle="First support reply after ticket creation" icon={Clock3}>
                <LineChart data={chartData} series={[{ key: 'averageResponseMinutes', label: 'Response time', color: 'cyan' }]} formatValue={(value) => `${value}m`} />
              </ChartFrame>
              <ChartFrame title="Escalation Rate" subtitle="Escalated tickets as a share of tickets created that day" icon={AlertTriangle}>
                <LineChart data={chartData} series={[{ key: 'escalationRate', label: 'Escalation rate', color: 'amber' }]} formatValue={(value) => `${value}%`} />
              </ChartFrame>
              <ChartFrame title="Customer Satisfaction" subtitle="Mean submitted survey score by ticket creation day, out of 5" icon={Star}>
                <LineChart data={chartData} series={[{ key: 'csat', label: 'CSAT', color: 'purple' }]} formatValue={(value) => `${value}/5`} emptyMessage="No survey responses in this period." />
              </ChartFrame>
              <ChartFrame title="Top Categories" subtitle="Ticket volume by customer-selected category" icon={BarChart3} className="analytics-categories-card">
                <CategoryBars categories={report.topCategories} />
              </ChartFrame>
              <ChartFrame title="Escalation Volume" subtitle="Escalated tickets by creation cohort" icon={MessageSquare}>
                <LineChart data={chartData} series={[{ key: 'escalated', label: 'Escalated tickets', color: 'amber' }]} emptyMessage="No escalations in this period." />
              </ChartFrame>
            </div>
          )}
          <footer className="triage-footer"><span>© 2026 NEXA Support Desk</span><span><ShieldCheck size={12} /> Metrics are calculated from recorded ticket and survey activity</span></footer>
        </main>
      </div>
    </div>
  )
}
