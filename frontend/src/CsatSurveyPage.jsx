import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check, CircleHelp, Send, ShieldCheck, Star, Ticket } from 'lucide-react'
import { DashboardSidebar, CustomerTopbar } from './CustomerPages.jsx'
import { useAuth } from './useAuth.js'
import api from './api.js'
import './Customer.css'
import './CsatSurvey.css'

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function displayTicketId(value) {
  return value?.slice(-6).toUpperCase()
}

export function CsatSurveyPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tickets, setTickets] = useState([])
  const [surveys, setSurveys] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let active = true
    api.get('/csat')
      .then(({ data }) => {
        if (!active) return
        setTickets(data.tickets)
        setSurveys(data.surveys)
        const requestedTicket = searchParams.get('ticket')?.replace(/[^a-z0-9]/gi, '').toUpperCase()
        const requestedMatch = requestedTicket && data.tickets.find((ticket) =>
          ticket._id.toUpperCase().endsWith(requestedTicket),
        )
        setSelectedId(requestedMatch?._id || data.tickets[0]?._id || '')
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load your completed tickets.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [searchParams])

  const selectedTicket = tickets.find((ticket) => ticket._id === selectedId)
  const selectedSurvey = surveys.find((survey) => String(survey.ticketId) === selectedId)
  const eligibleTickets = useMemo(
    () => tickets.filter((ticket) => !surveys.some((survey) => String(survey.ticketId) === ticket._id)),
    [tickets, surveys],
  )

  const selectTicket = (ticketId) => {
    setSelectedId(ticketId)
    setRating(0)
    setFeedback('')
    setError('')
  }

  const submitFeedback = async (event) => {
    event.preventDefault()
    if (!selectedTicket || !rating || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const { data } = await api.post('/csat', {
        ticketId: selectedTicket._id,
        rating,
        feedback,
      })
      setSurveys((current) => [data.survey, ...current])
      setFeedback('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your feedback could not be submitted. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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

  return (
    <div className="customer-app site-shell">
      <DashboardSidebar active="csat" onLogout={handleLogout} loggingOut={loggingOut} />
      <div className="customer-main">
        <CustomerTopbar name={user?.fullName} />
        <main className="customer-content csat-content">
          <div className="customer-greeting-row">
            <div>
              <p className="eyebrow"><span className="live-dot" /> CUSTOMER EXPERIENCE</p>
              <h1>Customer Feedback</h1>
              <p className="customer-greeting-sub">A quick rating helps us make every support conversation better.</p>
            </div>
            <Link className="button button-quiet" to="/customer/tickets"><Ticket size={14} /> My Tickets</Link>
          </div>

          {error && <div className="customer-error" role="alert"><CircleHelp size={15} /><span>{error}</span></div>}
          {logoutError && <div className="customer-error" role="alert"><AlertTriangle size={15} /><span>{logoutError}</span></div>}
          {loading ? (
            <div className="ticket-empty-state" role="status"><span className="loading-ring" /><p>Loading completed tickets…</p></div>
          ) : tickets.length === 0 ? (
            <section className="csat-no-tickets">
              <span><Ticket size={22} /></span>
              <h2>No completed tickets to rate</h2>
              <p>Once your support request is resolved, you can share your experience here.</p>
              <Link className="button button-primary" to="/customer/tickets">View my tickets <ArrowRight size={13} /></Link>
            </section>
          ) : (
            <div className="csat-layout">
              <section className="csat-ticket-picker">
                <header><div><p className="eyebrow"><span className="eyebrow-line" /> COMPLETED REQUESTS</p><h2>Choose a ticket</h2></div><span>{eligibleTickets.length} awaiting feedback</span></header>
                <div className="csat-ticket-list">
                  {tickets.map((ticket) => {
                    const submittedSurvey = surveys.find((survey) => String(survey.ticketId) === ticket._id)
                    return (
                      <button className={`csat-ticket-option${ticket._id === selectedId ? ' selected' : ''}`} key={ticket._id} type="button" onClick={() => selectTicket(ticket._id)}>
                        <span className="csat-ticket-mark"><Ticket size={14} /></span>
                        <span className="csat-ticket-info"><strong>{ticket.subject}</strong><small>#{displayTicketId(ticket._id)} · {formatDate(ticket.createdAt)}</small></span>
                        {submittedSurvey ? <span className="csat-ticket-rated"><Check size={11} /> Rated</span> : <span className="csat-ticket-pending">Rate</span>}
                      </button>
                    )
                  })}
                </div>
              </section>

              {selectedTicket && (
                <section className="csat-form-card" aria-labelledby="csat-question">
                  {selectedSurvey ? (
                    <div className="csat-thank-you" role="status">
                      <span className="csat-thank-you-icon"><Check size={25} /></span>
                      <p className="eyebrow"><span className="eyebrow-line" /> FEEDBACK RECEIVED</p>
                      <h2>Thank you!</h2>
                      <p>Your feedback helps the NEXA team make support feel more human.</p>
                      <div className="csat-submitted-rating" aria-label={`Your rating: ${selectedSurvey.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={18} fill={star <= selectedSurvey.rating ? 'currentColor' : 'none'} />)}</div>
                      {selectedSurvey.feedback && <blockquote>“{selectedSurvey.feedback}”</blockquote>}
                      <small>Ticket #{displayTicketId(selectedTicket._id)} · Submitted {formatDate(selectedSurvey.createdAt)}</small>
                    </div>
                  ) : (
                    <form onSubmit={submitFeedback}>
                      <div className="csat-form-heading"><span><Star size={17} /></span><p className="eyebrow"><span className="eyebrow-line" /> SUPPORT FOLLOW-UP</p></div>
                      <h2 id="csat-question">How did we do?</h2>
                      <p className="csat-ticket-context">Your experience with <strong>{selectedTicket.subject}</strong></p>
                      <fieldset className="csat-rating-picker" disabled={submitting}>
                        <legend>Rate your support experience from one to five stars</legend>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setRating(value)}
                            aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                            aria-pressed={rating === value}
                          >
                            <Star size={27} fill={value <= rating ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </fieldset>
                      <p className={`csat-rating-caption${rating ? ' has-rating' : ''}`} aria-live="polite">{rating ? ['','Not satisfied','Could be better','It was okay','Very good','Excellent'][rating] : 'Select a rating'}</p>
                      <label className="csat-feedback-label" htmlFor="csat-feedback">Feedback <span>Optional</span>
                        <textarea id="csat-feedback" value={feedback} maxLength={1000} rows={4} onChange={(event) => setFeedback(event.target.value)} placeholder="Tell us what went well or what we could improve…" />
                        <small>{feedback.length}/1000 characters</small>
                      </label>
                      <div className="csat-form-footer"><span><ShieldCheck size={12} /> Feedback is linked to this ticket only</span><button className="button button-primary" type="submit" disabled={!rating || submitting}>{submitting ? 'Submitting…' : 'Submit Feedback'} <Send size={13} /></button></div>
                    </form>
                  )}
                </section>
              )}
            </div>
          )}
          <footer className="customer-footer"><span>© 2026 NEXA Support Desk</span><span>AI-Powered. Human-Centered. Always On.</span></footer>
        </main>
      </div>
    </div>
  )
}
