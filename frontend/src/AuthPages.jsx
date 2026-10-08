import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useAuth } from './useAuth.js'
import { roleDestination, roleLabels, rolePaths } from './auth-utils.js'
import './Auth.css'

function RoleRedirect({ user }) {
  return <Navigate to={rolePaths[user.role] || '/login'} replace />
}

function AuthBrand() {
  return (
    <Link className="brand auth-brand" to="/" aria-label="NEXA home">
      <img className="brand-mark" src="/nexa-mark.svg" alt="" />
      <span className="brand-word">NEXA</span>
    </Link>
  )
}

function AuthVisual({ register = false }) {
  return (
    <aside className="auth-visual">
      <div className="auth-visual-grid" />
      <div className="auth-orbit auth-orbit-one" />
      <div className="auth-orbit auth-orbit-two" />
      <AuthBrand />
      <div className="auth-pitch">
        <p className="eyebrow"><span className="live-dot" /> NEXA / SUPPORT INTELLIGENCE</p>
        <h1>{register ? <>A better way<br />to <span>care.</span></> : <>Support that<br /><span>gets you.</span></>}</h1>
        <p>AI-Powered. Human-Centered. Always On.</p>
      </div>
      <div className="auth-robot" aria-hidden="true">
        <div className="auth-robot-glow" />
        <div className="auth-robot-head">
          <i className="auth-robot-antenna" />
          <div className="auth-robot-face"><i /><i /><span /></div>
        </div>
        <div className="auth-robot-neck" />
        <div className="auth-robot-body"><span><Sparkles size={20} /></span></div>
        <div className="auth-robot-platform" />
      </div>
      <div className="auth-visual-note"><ShieldCheck size={15} /><span>People-first support, powered by AI</span></div>
      <div className="auth-visual-footer">NEXA MULTI-AGENT CUSTOMER SUPPORT DESK</div>
    </aside>
  )
}

function AuthFrame({ children, register = false, login = false }) {
  return (
    <main className={`auth-layout${register ? ' auth-register-layout' : ''}${login ? ' auth-login-layout' : ''}`}>
      {login && (
        <>
          <video className="auth-login-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
            <source src="https://v.ftcdn.net/19/50/02/07/700_F_1950020738_d1gS9gkU8xBb1TMt8zztvTnxpuqGH28m_ST.mp4" type="video/mp4" />
          </video>
          <div className="auth-login-video-overlay" aria-hidden="true" />
        </>
      )}
      <AuthVisual register={register} />
      <section className="auth-form-side">
        <Link className="auth-back" to="/"><ArrowLeft size={15} /> Back to home</Link>
        <div className="auth-form-wrap">{children}</div>
        <p className="auth-side-foot">© 2026 NEXA Support Desk <span>•</span> Secure sign-in</p>
      </section>
    </main>
  )
}

function FormAlert({ children }) {
  if (!children) return null
  return <div className="auth-alert" role="alert">{children}</div>
}

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '', rememberMe: false })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) navigate(rolePaths[user.role] || '/login', { replace: true })
  }, [loading, user, navigate])

  if (loading) return <div className="auth-loading" role="status">Checking your secure session…</div>
  if (user) return <RoleRedirect user={user} />

  const update = (event) => {
    const { name, value, checked, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!form.email.trim() || !form.password) {
      setError('Enter your email and password to sign in.')
      return
    }
    setSubmitting(true)
    try {
      const signedInUser = await login(form)
      navigate(location.state?.from || rolePaths[signedInUser.role] || '/login', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reach NEXA. Check that the backend is running and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame login>
      <div className="auth-form-heading">
        <div className="auth-mobile-brand"><AuthBrand /></div>
        <p className="eyebrow"><span className="eyebrow-line" /> WELCOME BACK</p>
        <h2>Sign in to NEXA</h2>
        <p>Pick up where your team left off.</p>
      </div>
      <FormAlert>{error}</FormAlert>
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-label" htmlFor="login-email">Email address</label>
        <div className="auth-input-wrap">
          <Mail size={16} />
          <input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={update} required />
        </div>
        <div className="auth-label-row">
          <label className="auth-label" htmlFor="login-password">Password</label>
          <button
            className="auth-text-button"
            type="button"
            onClick={() => navigate('/contact', {
              state: {
                prefill: {
                  email: form.email.trim(),
                  message: 'I need help regaining access to my NEXA account. Please contact me with the next steps.',
                },
              },
            })}
          >
            Forgot password?
          </button>
        </div>
        <div className="auth-input-wrap">
          <LockKeyhole size={16} />
          <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={update} required />
          <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="auth-form-options">
          <label className="auth-checkbox"><input type="checkbox" name="rememberMe" checked={form.rememberMe} onChange={update} /><span className="checkmark"><Check size={11} /></span> Remember me</label>
          <span className="session-hint">Secure session</span>
        </div>
        <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Login'} {!submitting && <ArrowRight size={16} />}
        </button>
      </form>
      <div className="auth-role-note">
        <ShieldCheck size={15} />
        <div>
          <strong>Workspace roles</strong>
          <div className="role-chip-list">
            <span>Customer</span><span>Agent</span><span>Supervisor</span><span>Admin</span>
          </div>
          <p>Access is assigned to your account. A role choice here cannot grant permissions.</p>
        </div>
      </div>
      <p className="auth-switch">New to NEXA? <Link to="/register">Create an account <ArrowRight size={14} /></Link></p>
      {location.state?.message && <p className="auth-inline-note" role="status">{location.state.message}</p>}
    </AuthFrame>
  )
}

function getPasswordStrength(password) {
  return [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length
}

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const strength = getPasswordStrength(form.password)

  useEffect(() => {
    if (!loading && user) navigate(rolePaths[user.role] || '/login', { replace: true })
  }, [loading, user, navigate])

  if (loading) return <div className="auth-loading" role="status">Checking your secure session…</div>
  if (user) return <RoleRedirect user={user} />

  const update = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const nextErrors = {}
    if (form.fullName.trim().length < 2) nextErrors.fullName = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (!/^\+?[0-9][0-9\s()-]{6,19}$/.test(form.mobileNumber.trim())) nextErrors.mobileNumber = 'Enter a valid mobile number.'
    if (strength < 4 || new TextEncoder().encode(form.password).length > 72) {
      nextErrors.password = 'Use 8–72 bytes with upper/lowercase, a number, and a symbol.'
    }
    if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const newUser = await register({
        fullName: form.fullName,
        email: form.email,
        mobileNumber: form.mobileNumber,
        password: form.password,
      })
      navigate(rolePaths[newUser.role] || '/login', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reach NEXA. Check that the backend is running and try again.')
      setFieldErrors(requestError.response?.data?.errors || {})
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame register>
      <div className="auth-form-heading">
        <div className="auth-mobile-brand"><AuthBrand /></div>
        <p className="eyebrow"><span className="eyebrow-line" /> YOUR SUPPORT STARTS HERE</p>
        <h2>Create your account</h2>
        <p>Get your team and customers moving forward.</p>
      </div>
      <FormAlert>{error}</FormAlert>
      <form className="auth-form register-form" onSubmit={submit} noValidate>
        <label className="auth-label" htmlFor="register-name">Full name</label>
        <div className="auth-input-wrap">
          <UserRound size={16} />
          <input id="register-name" name="fullName" autoComplete="name" placeholder="Your name" value={form.fullName} onChange={update} required aria-invalid={Boolean(fieldErrors.fullName)} />
        </div>
        {fieldErrors.fullName && <span className="field-error">{fieldErrors.fullName}</span>}

        <label className="auth-label" htmlFor="register-email">Email address</label>
        <div className="auth-input-wrap">
          <Mail size={16} />
          <input id="register-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={update} required aria-invalid={Boolean(fieldErrors.email)} />
        </div>
        {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}

        <label className="auth-label" htmlFor="register-mobile">Mobile number</label>
        <div className="auth-input-wrap">
          <span className="phone-prefix">+</span>
          <input id="register-mobile" name="mobileNumber" type="tel" autoComplete="tel" placeholder="1 555 010 2048" value={form.mobileNumber} onChange={update} required aria-invalid={Boolean(fieldErrors.mobileNumber)} />
        </div>
        {fieldErrors.mobileNumber && <span className="field-error">{fieldErrors.mobileNumber}</span>}

        <label className="auth-label" htmlFor="register-password">Password</label>
        <div className="auth-input-wrap">
          <LockKeyhole size={16} />
          <input id="register-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Create a strong password" value={form.password} onChange={update} required aria-invalid={Boolean(fieldErrors.password)} />
          <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="password-strength" aria-label={`Password strength: ${strength} of 4`}>
          <div className="strength-bars">{[0, 1, 2, 3].map((index) => <i key={index} className={strength > index ? `strength-level-${strength}` : ''} />)}</div>
          <span>{form.password ? ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][strength] : 'Use 8+ characters, mixed case, a number & symbol'}</span>
        </div>
        {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}

        <label className="auth-label" htmlFor="register-confirm">Confirm password</label>
        <div className="auth-input-wrap">
          <LockKeyhole size={16} />
          <input id="register-confirm" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your password" value={form.confirmPassword} onChange={update} required aria-invalid={Boolean(fieldErrors.confirmPassword)} />
        </div>
        {fieldErrors.confirmPassword && <span className="field-error">{fieldErrors.confirmPassword}</span>}

        <label className="auth-label" htmlFor="register-role">Account role</label>
        <div className="auth-input-wrap auth-role-select">
          <ShieldCheck size={16} />
          <select id="register-role" value="customer" disabled aria-describedby="role-help">
            <option value="customer">Customer</option>
          </select>
        </div>
        <span className="role-help" id="role-help">Agent, supervisor, and admin access is assigned by an administrator.</span>

        <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'} {!submitting && <ArrowRight size={16} />}
        </button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link></p>
    </AuthFrame>
  )
}

export function DashboardEntry() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const signOut = async () => {
    setError('')
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign out because the NEXA API is unreachable.')
    }
  }

  return (
    <main className="dashboard-entry site-shell">
      <header className="site-header">
        <div className="header-inner"><AuthBrand /><button className="auth-text-button" type="button" onClick={signOut}>Sign out</button></div>
      </header>
      <section className="dashboard-welcome">
        <p className="eyebrow"><span className="live-dot" /> SECURE WORKSPACE</p>
        <h1>Welcome, <span>{user?.fullName?.split(' ')[0]}</span>.</h1>
        <p className="dashboard-role">{roleLabels[user?.role] || 'NEXA member'} access is active for this account.</p>
        <div className="dashboard-next-card">
          <div className="dialog-icon"><Sparkles size={21} /></div>
          <h2>Your support workspace is ready.</h2>
          <p>Review incoming tickets, triage customer requests, and prepare replies for human approval.</p>
          <div className="dashboard-tool-links">
            <Link className="button button-quiet" to={`/${user?.role}/chat`}>Live Chat <AudioLines size={15} /></Link>
            <Link className="button button-primary" to={`/${user?.role}/triage`}>AI Triage Center <ArrowRight size={15} /></Link>
            <Link className="button button-quiet" to={`/${user?.role}/draft-reply`}>AI Draft Reply <ArrowRight size={15} /></Link>
          </div>
          <button className="auth-text-button dashboard-sign-out" type="button" onClick={signOut}>Sign out securely</button>
        </div>
        {error && <FormAlert>{error}</FormAlert>}
      </section>
    </main>
  )
}

export function NotFoundPage() {
  const { user } = useAuth()
  return (
    <main className="auth-layout not-found-layout">
      <AuthVisual />
      <section className="auth-form-side not-found-content">
        <div className="not-found-copy">
          <span className="not-found-code">404 <i /></span>
          <p className="eyebrow"><span className="eyebrow-line" /> NEXA / ROUTE NOT FOUND</p>
          <h1>Oops! <span>Ticket Not Found</span></h1>
          <p className="not-found-description">Looks like this page drifted off the support radar. Let’s get you back to your workspace.</p>
          <Link className="button button-primary not-found-dashboard-button" to={user ? roleDestination(user.role) : '/login'}>
            Back to Dashboard <ArrowRight size={16} />
          </Link>
          <Link className="not-found-home-link" to="/">Return to NEXA home</Link>
        </div>
        <p className="auth-side-foot">© 2026 NEXA Support Desk <span>•</span> AI-Powered. Human-Centered. Always On.</p>
      </section>
    </main>
  )
}
