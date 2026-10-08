import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  Flame,
  Menu,
  MessageCircle,
  Mic,
  Play,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import './App.css'
import ErrorBoundary from './ErrorBoundary.jsx'
import { AuthProvider } from './AuthContext.jsx'
import { useAuth } from './useAuth.js'
import { roleDestination } from './auth-utils.js'
import { LoginPage, NotFoundPage, RegisterPage } from './AuthPages.jsx'
import { CreateTicketPage, CustomerDashboard } from './CustomerPages.jsx'
import { TriageCenterPage } from './TriagePages.jsx'
import { DraftReplyPage } from './DraftReplyPages.jsx'
import { LiveChatPage } from './LiveChatPages.jsx'
import { AgentDashboard } from './AgentDashboard.jsx'
import VoiceAssistant from './VoiceAssistant.jsx'
import { NotificationBell, NotificationProvider, NotificationsPage } from './Notifications.jsx'

const SupervisorAnalytics = lazy(() => import('./SupervisorAnalytics.jsx').then((module) => ({ default: module.SupervisorAnalytics })))
const KnowledgeBasePage = lazy(() => import('./KnowledgeBasePage.jsx').then((module) => ({ default: module.KnowledgeBasePage })))
const CsatSurveyPage = lazy(() => import('./CsatSurveyPage.jsx').then((module) => ({ default: module.CsatSurveyPage })))
const AdminConsole = lazy(() => import('./AdminConsole.jsx').then((module) => ({ default: module.AdminConsole })))
const ContactPage = lazy(() => import('./ContactPage.jsx').then((module) => ({ default: module.ContactPage })))

const features = [
  {
    icon: <Sparkles size={19} />,
    number: '01',
    title: 'AI Ticket Triage & Classification',
    description:
      'Every request is understood, prioritized, and routed to the right place in seconds.',
    color: 'blue',
  },
  {
    icon: <MessageCircle size={19} />,
    number: '02',
    title: 'Live Chat Support',
    description:
      'Bring an expert into the conversation whenever empathy matters most.',
    color: 'purple',
  },
  {
    icon: <AudioLines size={19} />,
    number: '03',
    title: 'Voice Control & Navigation',
    description:
      'Move through your support workspace with simple, hands-free commands.',
    color: 'cyan',
  },
  {
    icon: <ShieldCheck size={19} />,
    number: '04',
    title: 'Real-time insights',
    description:
      'See team performance and customer sentiment as they happen.',
    color: 'pink',
  },
]

function Brand({ compact = false }) {
  return (
    <Link className={`brand${compact ? ' brand-compact' : ''}`} to="/" aria-label="NEXA home">
      <img className="brand-mark" src="/nexa-mark.svg" alt="" />
      <span className="brand-word">NEXA</span>
    </Link>
  )
}

function NoticeDialog({ notice, onClose }) {
  useEffect(() => {
    if (!notice) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [notice, onClose])

  if (!notice) return null

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </button>
        <div className="dialog-icon"><Sparkles size={21} /></div>
        <p className="eyebrow">NEXA / PREVIEW</p>
        <h2 id="dialog-title">{notice.title}</h2>
        <p className="dialog-copy">{notice.message}</p>
        {notice.demo && (
          <div className="demo-flow">
            <div><span className="demo-step">01</span><span>Customer message received</span><Check size={15} /></div>
            <div><span className="demo-step">02</span><span>AI identifies billing question</span><Check size={15} /></div>
            <div><span className="demo-step">03</span><span>Draft prepared for human review</span><AudioLines size={15} /></div>
          </div>
        )}
        <button className="button button-primary dialog-action" type="button" onClick={onClose}>
          Got it <ArrowRight size={16} />
        </button>
      </section>
    </div>
  )
}

function SiteHeader({ onVoice }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <button
          className="icon-button menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <Link className={pathname === '/' ? 'active' : ''} to="/" onClick={closeMenu} aria-current={pathname === '/' ? 'page' : undefined}>Home</Link>
          <Link className={pathname === '/features' ? 'active' : ''} to="/features" onClick={closeMenu} aria-current={pathname === '/features' ? 'page' : undefined}>Features</Link>
          <Link className={pathname === '/about' ? 'active' : ''} to="/about" onClick={closeMenu} aria-current={pathname === '/about' ? 'page' : undefined}>About</Link>
          <Link className={pathname === '/contact' ? 'active' : ''} to="/contact" onClick={closeMenu} aria-current={pathname === '/contact' ? 'page' : undefined}>Contact</Link>
        </nav>
        <div className="header-actions">
          <button className="voice-nav-button" type="button" onClick={onVoice} aria-label="Open Voice Assistant">
            <Mic size={15} /> <span>Voice Assistant</span>
          </button>
          <Link className="login-link" to="/login" onClick={closeMenu}>
            Login
          </Link>
          <Link
            className="button button-small button-primary"
            to="/register"
            onClick={closeMenu}
          >
            Register <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  )
}

function HomeHeroArtwork() {
  return (
    <div className="hero-visual home-hero-visual">
      <div className="visual-halo" />
      <div className="visual-orbit orbit-one" />
      <div className="visual-orbit orbit-two" />
      <div className="home-ai-image-stage">
        <img className="home-ai-image" src="https://img.magnific.com/premium-photo/young-woman-with-robotic-exoskeleton-determined-expression-looks-directly-viewer_1294789-13852.jpg?semt=ais_hybrid&amp;w=740&amp;q=80" alt="AI support agent wearing a headset" />
      </div>
      <div className="float-card confidence-card home-confidence-card">
        <span className="float-icon confidence-icon"><TrendingUp size={16} /></span>
        <span><small>Confidence</small><strong>84%</strong><em>+12% this week</em></span>
      </div>
      <div className="float-card ticket-card home-ticket-card">
        <span className="float-icon ticket-icon"><Flame size={16} /></span>
        <span><small>High Priority</small><strong>3 tickets</strong><em>Avg response: 1m 22s</em></span>
      </div>
    </div>
  )
}


function AnimatedWallpaper({ className }) {
  return (
    <div className={className} aria-hidden="true">
      <img className="home-wallpaper-image" src="https://blog.auditoria.ai/hs-fs/hubfs/Agentic%20AI%E2%80%99s%20Future%20Place%20in%20Finance.png?width=900&height=471&name=Agentic%20AI%E2%80%99s%20Future%20Place%20in%20Finance.png" alt="" />
      <div className="home-wallpaper-blob home-wallpaper-blob-blue" />
      <div className="home-wallpaper-blob home-wallpaper-blob-purple" />
      <div className="home-wallpaper-blob home-wallpaper-blob-cyan" />
      <div className="home-wallpaper-gradient home-wallpaper-gradient-horizontal" />
      <div className="home-wallpaper-gradient home-wallpaper-gradient-vertical" />
      <div className="home-wallpaper-particles">
        {Array.from({ length: 20 }, (_, index) => (
          <i key={index} style={{ left: `${(index * 47 + 11) % 100}%`, top: `${(index * 61 + 7) % 100}%`, animationDelay: `${-((index * 3) % 8)}s`, animationDuration: `${3 + (index % 5)}s` }} />
        ))}
      </div>
    </div>
  )
}

function HomePage() {
  const [notice, setNotice] = useState(null)
  const navigate = useNavigate()

  return (
    <div className="site-shell home-page-shell">
      <AnimatedWallpaper className="home-live-wallpaper" />
      <SiteHeader onVoice={() => window.dispatchEvent(new Event('nexa:voice-start'))} />

      <main>
        <section className="hero-section page-width" id="home">
          <div className="hero-copy">
            <div className="hero-kicker home-live-badge"><span className="live-dot" /> NOW LIVE <i /> AI SUPPORT AGENTS</div>
            <h1><span className="home-heading-gradient">Multi-Agent</span><br /><span className="home-heading-gradient">Customer Support</span><br /><span className="home-heading-white">Desk</span></h1>
            <p className="hero-tagline">AI-Powered, Human-Centered, Always On</p>
            <div className="hero-buttons">
              <button className="button button-primary button-large home-cta-primary" type="button" onClick={() => navigate('/register')}>
                Get Started <ArrowRight size={17} />
              </button>
              <button
                className="button button-quiet button-large home-cta-secondary"
                type="button"
                onClick={() => setNotice({
                  title: 'A smarter support workflow',
                  message: 'See how NEXA understands an incoming request, prepares a suggested reply, and keeps a human in control.',
                  demo: true,
                })}
              >
                <span className="play-button"><Play size={9} fill="currentColor" /></span> Watch Demo
              </button>
            </div>
            <div className="hero-proof home-proof-badges">
              <span>99.9% Uptime</span>
              <span>Secure &amp; Compliant</span>
              <span>24/7 Response</span>
            </div>
          </div>
          <HomeHeroArtwork />
        </section>
        <section className="home-destination-cards page-width" aria-label="Explore NEXA">
          <Link className="home-destination-card home-destination-home" to="/">
            <h2>Home</h2>
            <p>AI-powered support dashboard</p>
          </Link>
          <Link className="home-destination-card home-destination-features" to="/features">
            <h2>Features</h2>
            <p>Voice, Chat, Triage agents</p>
          </Link>
          <Link className="home-destination-card home-destination-about" to="/about">
            <h2>About</h2>
            <p>More than automation</p>
          </Link>
        </section>
      </main>

      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
    </div>
  )
}

function PublicRouteFrame({ children, className = '' }) {
  return (
    <div className={`site-shell public-route-shell ${className}`.trim()}>
      {className === 'features-page-shell' && (
        <>
          <video className="features-background-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
            <source src="https://www.shutterstock.com/shutterstock/videos/3524592415/preview/stock-footage-stock-broker-analysis-a-holographic-running-ticker-line-displaying-dynamic-stock-data-trading.webm" type="video/webm" />
          </video>
          <div className="features-background-overlay" aria-hidden="true" />
        </>
      )}
      {className === 'about-page-shell' && (
        <>
          <img
            className="about-background-image"
            src="https://image.shutterstock.com/image-photo/young-female-biologist-analyzes-protein-structures-260nw-2615909843.jpg"
            alt=""
            aria-hidden="true"
          />
          <div className="about-background-overlay" aria-hidden="true" />
        </>
      )}
      <SiteHeader onVoice={() => window.dispatchEvent(new Event('nexa:voice-start'))} />
      <main className="public-route-main">{children}</main>
      <footer className="site-footer">
        <div className="footer-inner">
          <Brand compact />
          <span className="footer-caption">AI-Powered. Human-Centered. Always On.</span>
          <span className="footer-copy">© 2026 NEXA Support Desk</span>
        </div>
      </footer>
    </div>
  )
}

function FeaturesPage() {
  return (
    <PublicRouteFrame className="features-page-shell">
      <section className="features-section section-wrap">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> ONE DESK. EVERY ADVANTAGE.</p>
            <h1>Support that thinks<br /><span>one step ahead.</span></h1>
          </div>
          <p className="section-summary">Give every conversation the right balance of speed, intelligence, and human understanding.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className={`feature-card feature-${feature.color}`} key={feature.number}>
              <div className="feature-top"><span className="feature-icon">{feature.icon}</span><span className="feature-number">{feature.number} / 04</span></div>
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
              <span className="feature-line" />
            </article>
          ))}
        </div>
        <Link className="text-link public-route-cta" to="/about">Discover the NEXA difference <ArrowRight size={16} /></Link>
      </section>
    </PublicRouteFrame>
  )
}

function AboutPage() {
  return (
    <PublicRouteFrame className="about-page-shell">
      <section className="about-section section-wrap">
        <div className="about-visual">
          <div className="about-glow" />
          <div className="about-panel">
            <div className="panel-top"><span><i /> NEXA INTELLIGENCE</span><span>PREVIEW</span></div>
            <div className="signal-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="panel-bottom"><span>Human-reviewed support</span><span>ACTIVE</span></div>
            <div className="panel-track"><i /></div>
          </div>
          <div className="about-note"><Zap size={15} /><span>AI that works <strong>with your team</strong></span></div>
        </div>
        <div className="about-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> THE NEXA DIFFERENCE</p>
          <h1>More than automation.<br /><span>A better way to <span className="about-care-word">care.</span></span></h1>
          <p>Great support is personal. NEXA brings specialized AI agents and real people together, so every customer gets a thoughtful answer without the wait.</p>
          <div className="about-points">
            <span><Check size={14} /> Human approval stays in control</span>
            <span><Check size={14} /> One connected support workspace</span>
          </div>
          <Link className="text-link" to="/features">Explore the platform <ArrowRight size={16} /></Link>
        </div>
      </section>
    </PublicRouteFrame>
  )
}

function RouteScrollReset() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <RouteScrollReset />
      <ErrorBoundary>
        <AuthProvider>
        <NotificationProvider>
        <VoiceAssistant />
        <NotificationBell floating />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<Suspense fallback={<main className="auth-loading" role="status">Loading contact page…</main>}><ContactPage /></Suspense>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/customer/dashboard" element={<ProtectedRoute role="customer"><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/customer/tickets" element={<ProtectedRoute role="customer"><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/customer/tickets/new" element={<ProtectedRoute role="customer"><CreateTicketPage /></ProtectedRoute>} />
          <Route path="/customer/chat" element={<ProtectedRoute role="customer"><LiveChatPage /></ProtectedRoute>} />
          <Route path="/customer/knowledge" element={<ProtectedRoute role="customer"><Suspense fallback={<main className="auth-loading" role="status">Loading knowledge base…</main>}><KnowledgeBasePage /></Suspense></ProtectedRoute>} />
          <Route path="/customer/csat" element={<ProtectedRoute role="customer"><Suspense fallback={<main className="auth-loading" role="status">Loading feedback survey…</main>}><CsatSurveyPage /></Suspense></ProtectedRoute>} />
          <Route path="/customer/notifications" element={<ProtectedRoute role="customer"><NotificationsPage /></ProtectedRoute>} />
          <Route path="/agent/dashboard" element={<ProtectedRoute role="agent"><AgentDashboard /></ProtectedRoute>} />
          <Route path="/agent/chat" element={<ProtectedRoute role="agent"><LiveChatPage /></ProtectedRoute>} />
          <Route path="/agent/knowledge" element={<ProtectedRoute role="agent"><Suspense fallback={<main className="auth-loading" role="status">Loading knowledge base…</main>}><KnowledgeBasePage /></Suspense></ProtectedRoute>} />
          <Route path="/agent/triage" element={<ProtectedRoute role="agent"><TriageCenterPage /></ProtectedRoute>} />
          <Route path="/agent/draft-reply" element={<ProtectedRoute role="agent"><DraftReplyPage /></ProtectedRoute>} />
          <Route path="/agent/notifications" element={<ProtectedRoute role="agent"><NotificationsPage /></ProtectedRoute>} />
          <Route path="/supervisor/dashboard" element={<ProtectedRoute role="supervisor"><Suspense fallback={<main className="auth-loading" role="status">Loading analytics workspace…</main>}><SupervisorAnalytics /></Suspense></ProtectedRoute>} />
          <Route path="/supervisor/analytics" element={<ProtectedRoute role="supervisor"><Suspense fallback={<main className="auth-loading" role="status">Loading analytics workspace…</main>}><SupervisorAnalytics /></Suspense></ProtectedRoute>} />
          <Route path="/supervisor/knowledge" element={<ProtectedRoute role="supervisor"><Suspense fallback={<main className="auth-loading" role="status">Loading knowledge base…</main>}><KnowledgeBasePage /></Suspense></ProtectedRoute>} />
          <Route path="/supervisor/chat" element={<ProtectedRoute role="supervisor"><LiveChatPage /></ProtectedRoute>} />
          <Route path="/supervisor/triage" element={<ProtectedRoute role="supervisor"><TriageCenterPage /></ProtectedRoute>} />
          <Route path="/supervisor/draft-reply" element={<ProtectedRoute role="supervisor"><DraftReplyPage /></ProtectedRoute>} />
          <Route path="/supervisor/notifications" element={<ProtectedRoute role="supervisor"><NotificationsPage /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><Suspense fallback={<main className="auth-loading" role="status">Loading admin workspace…</main>}><AdminConsole /></Suspense></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute role="admin"><Suspense fallback={<main className="auth-loading" role="status">Loading user management…</main>}><AdminConsole section="/admin/users" /></Suspense></ProtectedRoute>} />
          <Route path="/admin/tickets" element={<ProtectedRoute role="admin"><Suspense fallback={<main className="auth-loading" role="status">Loading ticket management…</main>}><AdminConsole section="/admin/tickets" /></Suspense></ProtectedRoute>} />
          <Route path="/admin/config" element={<ProtectedRoute role="admin"><Suspense fallback={<main className="auth-loading" role="status">Loading AI configuration…</main>}><AdminConsole section="/admin/config" /></Suspense></ProtectedRoute>} />
          <Route path="/admin/permissions" element={<ProtectedRoute role="admin"><Suspense fallback={<main className="auth-loading" role="status">Loading permissions…</main>}><AdminConsole section="/admin/permissions" /></Suspense></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={<ProtectedRoute role="admin"><Suspense fallback={<main className="auth-loading" role="status">Loading audit history…</main>}><AdminConsole section="/admin/audit-logs" /></Suspense></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute role="admin"><Suspense fallback={<main className="auth-loading" role="status">Loading workspace settings…</main>}><AdminConsole section="/admin/settings" /></Suspense></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute role="admin"><Suspense fallback={<main className="auth-loading" role="status">Loading analytics workspace…</main>}><SupervisorAnalytics /></Suspense></ProtectedRoute>} />
          <Route path="/admin/knowledge" element={<ProtectedRoute role="admin"><Suspense fallback={<main className="auth-loading" role="status">Loading knowledge base…</main>}><KnowledgeBasePage /></Suspense></ProtectedRoute>} />
          <Route path="/admin/chat" element={<ProtectedRoute role="admin"><LiveChatPage /></ProtectedRoute>} />
          <Route path="/admin/triage" element={<ProtectedRoute role="admin"><TriageCenterPage /></ProtectedRoute>} />
          <Route path="/admin/draft-reply" element={<ProtectedRoute role="admin"><DraftReplyPage /></ProtectedRoute>} />
          <Route path="/admin/notifications" element={<ProtectedRoute role="admin"><NotificationsPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </NotificationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

function ProtectedRoute({ role, children }) {
  const { user, loading, sessionError } = useAuth()
  const location = useLocation()
  if (loading) return <main className="auth-loading" role="status">Verifying your secure session…</main>
  if (!user && sessionError === 'Your session has expired. Please sign in again.') {
    return <Navigate to="/login" replace state={{ message: sessionError }} />
  }
  if (!user && sessionError) return <main className="auth-loading" role="alert">{sessionError} <Link to="/login">Return to sign in</Link></main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={roleDestination(user.role)} replace />
  return children
}

export default App
