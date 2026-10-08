import { Component } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('NEXA interface failed to render.', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-screen" role="alert">
          <div className="app-error-orbit" aria-hidden="true" />
          <div className="app-error-card">
            <span className="app-error-icon"><ShieldAlert size={24} /></span>
            <p className="eyebrow">NEXA / RECOVERY MODE</p>
            <h1>We hit a temporary snag.</h1>
            <p className="app-error-copy">Your support workspace could not finish loading. Your account data is safe. Try again or return to the NEXA home page.</p>
            <div className="app-error-actions">
              <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
                Try again <RefreshCw size={15} />
              </button>
              <Link className="button button-quiet" to="/">
                <ArrowLeft size={15} /> Back to home
              </Link>
            </div>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
