import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, AudioLines, Check, Headset, Mail,
  MapPin, MessageCircle, Send, ShieldCheck, X,
} from 'lucide-react'
import api from './api.js'
import './ContactPage.css'

const initialForm = { name: '', email: '', subject: '', message: '', company: '' }

function ContactBrand() {
  return <Link className="brand contact-brand" to="/" aria-label="NEXA home"><img className="brand-mark" src="/nexa-mark.svg" alt="" /><span className="brand-word">NEXA</span></Link>
}

export function ContactPage() {
  const location = useLocation()
  const [form, setForm] = useState(() => ({
    ...initialForm,
    ...location.state?.prefill,
  }))
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const update = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setError('')
    setSuccess(false)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    setErrors({})
    try {
      const { subject, ...submission } = form
      await api.post('/contact', { ...submission, message: subject ? `Subject: ${subject}\n\n${form.message}` : form.message })
      setForm(initialForm)
      setSuccess(true)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not send your message. Please try again.')
      setErrors(requestError.response?.data?.errors || {})
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="contact-page site-shell">
      <video className="contact-background-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
        <source src="https://www.shutterstock.com/shutterstock/videos/1109752717/preview/stock-footage-timelapse-footage-busy-work-day-stock-exchange.webm" type="video/webm" />
      </video>
      <div className="contact-background-overlay" aria-hidden="true" />
      <header className="contact-header">
        <ContactBrand />
        <nav aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/features">Features</Link>
          <Link to="/about">About</Link>
          <Link className="active" to="/contact" aria-current="page">Contact</Link>
        </nav>
        <div className="contact-header-actions">
          <Link className="contact-chat-shortcut" to="/customer/chat"><AudioLines size={14} /> Live Chat</Link>
          <button className="contact-voice-shortcut" type="button" onClick={() => window.dispatchEvent(new Event('nexa:voice-start'))}><AudioLines size={14} /><span>Voice Assistant</span></button>
          <Link className="contact-login-link" to="/login">Login</Link>
          <Link className="button button-small button-primary" to="/register">Get Started <ArrowRight size={14} /></Link>
        </div>
      </header>

      <main className="contact-main">
        <Link className="contact-back-link" to="/"><ArrowLeft size={13} /> Back to home</Link>
        <section className="contact-hero">
          <div className="contact-hero-copy">
            <p className="contact-eyebrow"><span /> NEXA SUPPORT DESK</p>
            <h1>Contact Us</h1>
            <p>Get in touch with our support team. We're here to help 24/7 with technical issues, billing questions, and general inquiries.</p>
          </div>
        </section>

        <section className="contact-detail-grid" aria-label="Contact options">
          <article className="contact-detail-card contact-tone-cyan">
            <span className="contact-detail-icon icon-location"><MapPin size={19} /></span>
            <div><h3>LOCATION</h3><strong>San Francisco, CA</strong><p>100 Market Street,<br />Suite 2402</p></div>
          </article>
          <article className="contact-detail-card contact-tone-purple">
            <span className="contact-detail-icon icon-email"><Mail size={19} /></span>
            <div><h3>EMAIL</h3><a href="mailto:support@nexa.ai">support@nexa.ai</a><p>Response within 5 minutes</p></div>
          </article>
          <article className="contact-detail-card contact-tone-green">
            <span className="contact-detail-icon icon-phone"><Headset size={19} /></span>
            <div><h3>PHONE</h3><a href="tel:+14155550198">+1 (415) 555-0198</a><p>Mon&ndash;Fri 9AM&ndash;6PM PST</p></div>
          </article>
          <article className="contact-detail-card contact-tone-orange">
            <span className="contact-detail-icon icon-chat"><MessageCircle size={19} /></span>
            <div><h3>LIVE CHAT</h3><Link to="/customer/chat">Chat Now <ArrowRight size={13} /></Link><p>Average wait &lt;2 min</p></div>
          </article>
        </section>

        <section className="contact-form-section">
          <div className="contact-form-aside contact-bottom-card">
            <p className="contact-eyebrow"><span /> HERE FOR YOU, 24/7</p>
            <h2>We'd love to<br /><span>hear from you</span></h2>
            <p>Whatever you need, the NEXA team is ready to help make things easier.</p>
            <ul className="contact-help-list">
              <li><Check size={15} /> Technical support and troubleshooting</li>
              <li><Check size={15} /> Billing and account questions</li>
              <li><Check size={15} /> Product guidance and general inquiries</li>
            </ul>
            <div className="contact-trusted-badge"><ShieldCheck size={16} /><span><strong>Trusted support</strong><small>Your privacy is always protected</small></span></div>
            <div className="contact-aside-decoration" aria-hidden="true" />
          </div>
          <form className="contact-form contact-bottom-card" onSubmit={submit} noValidate>
            <div className="contact-form-heading"><span className="contact-form-icon"><Send size={16} /></span><span><strong>Contact our team</strong><small>We usually reply within one business day.</small></span><span className="contact-form-status"><i /> SECURE</span></div>
            {success && <div className="contact-success" role="status"><span><Check size={15} /></span><div><strong>Message received</strong><small>Thanks for reaching out. Our team will be in touch.</small></div><button type="button" onClick={() => setSuccess(false)} aria-label="Dismiss success message"><X size={14} /></button></div>}
            {error && <div className="contact-error" role="alert">{error}</div>}
            <div className="contact-fields-row">
              <label htmlFor="contact-name">Name<input id="contact-name" name="name" autoComplete="name" required minLength={2} maxLength={80} value={form.name} onChange={update} placeholder="Your name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'contact-name-error' : undefined} />{errors.name && <small id="contact-name-error" className="contact-field-error">{errors.name}</small>}</label>
              <label htmlFor="contact-email">Email<input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={update} placeholder="you@company.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'contact-email-error' : undefined} />{errors.email && <small id="contact-email-error" className="contact-field-error">{errors.email}</small>}</label>
            </div>
            <label htmlFor="contact-subject">Subject<input id="contact-subject" name="subject" required maxLength={160} value={form.subject} onChange={update} placeholder="How can we help?" aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? 'contact-subject-error' : undefined} />{errors.subject && <small id="contact-subject-error" className="contact-field-error">{errors.subject}</small>}</label>
            <label htmlFor="contact-message">Message<textarea id="contact-message" name="message" required minLength={10} maxLength={3800} rows={5} value={form.message} onChange={update} placeholder="Tell us how we can help&hellip;" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'contact-message-error' : 'contact-message-count'} />{errors.message ? <small id="contact-message-error" className="contact-field-error">{errors.message}</small> : <small id="contact-message-count" className="contact-message-count">{form.message.length}/3800 characters</small>}</label>
            <label className="contact-honeypot" aria-hidden="true" tabIndex="-1">Company<input name="company" autoComplete="off" tabIndex="-1" value={form.company} onChange={update} /></label>
            <div className="contact-submit-row"><span><ShieldCheck size={12} /> Encrypted in transit &middot; No spam</span><button className="button button-primary contact-submit" type="submit" disabled={submitting}>{submitting ? 'Sending...' : 'Send Message'} <ArrowRight size={14} /></button></div>
          </form>
        </section>
        <footer className="contact-footer"><ContactBrand /><span>AI-Powered. Human-Centered. Always On.</span><span>© 2026 NEXA Support Desk</span></footer>
      </main>
    </div>
  )
}
