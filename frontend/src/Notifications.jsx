import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, Bell, Bot, Check, CheckCheck,
  Clock3, MessageCircle, RefreshCw, ShieldCheck, UserCheck,
} from 'lucide-react'
import { roleDestination } from './auth-utils.js'
import { useAuth } from './useAuth.js'
import api from './api.js'
import './Notifications.css'

const apiOrigin = api.defaults.baseURL.replace(/\/api\/?$/, '')
const NotificationContext = createContext(null)

const notificationIcons = {
  ticket_assigned: UserCheck,
  ai_draft_ready: Bot,
  ticket_escalated: AlertTriangle,
  sla_warning: Clock3,
  customer_message: MessageCircle,
  ticket_resolved: Check,
}

function formatNotificationDate(value) {
  if (!value) return ''
  const date = new Date(value)
  const sameDay = date.toDateString() === new Date().toDateString()
  return new Intl.DateTimeFormat('en', sameDay
    ? { hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [ownerId, setOwnerId] = useState('')
  const userId = user?.id
  const liveNotifications = useRef(new Map())

  const loadNotifications = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
      setOwnerId(userId)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    liveNotifications.current.clear()
    const socket = io(apiOrigin, { withCredentials: true, transports: ['websocket', 'polling'] })
    socket.on('connect', () => { if (active) setConnected(true) })
    socket.on('disconnect', () => { if (active) setConnected(false) })
    socket.on('notification:new', (notification) => {
      if (!active) return
      if (liveNotifications.current.has(notification._id)) return
      liveNotifications.current.set(notification._id, notification)
      setNotifications((current) => [notification, ...current.filter((item) => item._id !== notification._id)].slice(0, 100))
      setUnreadCount((count) => count + 1)
    })
    api.get('/notifications')
      .then(({ data }) => {
        if (!active) return
        const knownIds = new Set(data.notifications.map((item) => item._id))
        const liveItems = [...liveNotifications.current.values()].filter((item) => !knownIds.has(item._id))
        setNotifications([...liveItems, ...data.notifications].slice(0, 100))
        setUnreadCount(data.unreadCount + liveItems.filter((item) => !item.readAt).length)
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load notifications.')
      })
      .finally(() => {
        if (active) {
          setOwnerId(userId)
          setLoading(false)
        }
      })
    return () => {
      active = false
      socket.disconnect()
    }
  }, [userId, loadNotifications])

  const markRead = useCallback(async (notificationId) => {
    try {
      const { data } = await api.patch(`/notifications/${notificationId}/read`)
      const wasUnread = notifications.some((item) => item._id === notificationId && !item.readAt)
      if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1))
      if (data.notification) setNotifications((current) => current.map((item) => item._id === notificationId ? data.notification : item))
      else setNotifications((current) => current.map((item) => item._id === notificationId ? { ...item, readAt: new Date().toISOString() } : item))
      return true
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update notification status.')
      return false
    }
  }, [notifications])

  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all')
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((item) => item.readAt ? item : { ...item, readAt }))
      setUnreadCount(0)
      return true
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to mark notifications as read.')
      return false
    }
  }, [])

  const ownNotifications = userId && ownerId === userId ? notifications : []
  const ownUnreadCount = userId && ownerId === userId ? unreadCount : 0
  const ownError = userId && ownerId !== userId ? '' : error

  return (
    <NotificationContext.Provider value={{
      notifications: ownNotifications,
      unreadCount: ownUnreadCount,
      loading: Boolean(userId && ownerId !== userId) || loading,
      error: ownError,
      connected: Boolean(userId && connected),
      loadNotifications, markRead, markAllRead, setError,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('Notification components must be inside NotificationProvider.')
  return context
}

export function NotificationBell({ floating = false }) {
  const { user } = useAuth()
  const location = useLocation()
  const { unreadCount, connected } = useNotifications()
  if (!user || (floating && location.pathname.endsWith('/notifications'))) return null
  const path = `/${user.role}/notifications`
  return (
    <Link className={`notification-bell${floating ? ' app-notification-bell' : ''}`} to={path} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} title={connected ? 'Notifications live' : 'Notification connection offline'}>
      <Bell size={17} />
      {unreadCount > 0 && <span className="notification-bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      <i className={connected ? 'connected' : ''} aria-hidden="true" />
    </Link>
  )
}

function NotificationDestination({ notification, role, onRead }) {
  const ticket = notification.ticketId
  const ticketSuffix = ticket ? String(ticket).slice(-6).toUpperCase() : ''
  const route = role === 'customer'
    ? ticket ? `/customer/tickets?ticket=${ticketSuffix}` : roleDestination(role)
    : ticket ? `/${role}/chat?ticket=${ticketSuffix}` : roleDestination(role)
  return (
    <Link className="notification-open-link" to={route} onClick={() => { if (!notification.readAt) void onRead(notification._id) }}>
      {ticket ? `Open ticket #${ticketSuffix}` : 'Open workspace'} <ArrowRight size={12} />
    </Link>
  )
}

export function NotificationsPage() {
  const { user } = useAuth()
  const { notifications, unreadCount, loading, error, connected, loadNotifications, markRead, markAllRead, setError } = useNotifications()
  const [actionError, setActionError] = useState('')
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'unread' ? notifications.filter((item) => !item.readAt) : notifications

  const handleMarkAll = async () => {
    setActionError('')
    if (!await markAllRead()) setActionError('Notifications could not be marked as read.')
  }
  return (
    <main className="notifications-page">
      <header className="notifications-topbar">
        <Link className="notifications-brand" to={roleDestination(user?.role)}><img src="/nexa-mark.svg" alt="" /><strong>NEXA</strong><span>Support Desk</span></Link>
        <div className="notifications-top-actions"><span className={`notifications-connection${connected ? ' online' : ''}`}><i />{connected ? 'LIVE UPDATES' : 'RECONNECTING'}</span><NotificationBell /></div>
      </header>
      <div className="notifications-content">
        <Link className="notifications-back" to={roleDestination(user?.role)}><ArrowLeft size={13} /> Back to workspace</Link>
        <div className="notifications-heading">
          <div><p className="notifications-eyebrow"><span /> WORKSPACE ACTIVITY</p><h1>Notifications</h1><p>Ticket assignments, customer replies, AI drafts, and service alerts — all in one place.</p></div>
          <div className="notifications-heading-actions">
            <button type="button" className="notifications-refresh" onClick={() => { setError(''); void loadNotifications() }} disabled={loading}><RefreshCw size={13} className={loading ? 'is-refreshing' : ''} /> Refresh</button>
            <button type="button" className="notifications-read-all" onClick={handleMarkAll} disabled={!unreadCount}><CheckCheck size={13} /> Mark all read</button>
          </div>
        </div>
        {(error || actionError) && <div className="notifications-error" role="alert"><AlertTriangle size={14} />{actionError || error}<button type="button" onClick={() => { setActionError(''); void loadNotifications() }}>Retry</button></div>}
        <section className="notifications-panel">
          <div className="notifications-filters">
            <div><button type="button" className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All <span>{notifications.length}</span></button><button type="button" className={filter === 'unread' ? 'selected' : ''} onClick={() => setFilter('unread')}>Unread <span>{unreadCount}</span></button></div>
            <span className="notifications-total"><Activity size={12} /> {connected ? 'Real-time sync active' : 'Saved updates available offline'}</span>
          </div>
          {loading && notifications.length === 0 ? (
            <div className="notifications-empty" role="status"><span className="loading-ring" /><p>Loading your notifications…</p></div>
          ) : filtered.length ? (
            <div className="notifications-list">
              {filtered.map((notification) => {
                const Icon = notificationIcons[notification.type] || Bell
                return (
                  <article className={`notification-card${notification.readAt ? '' : ' unread'}`} key={notification._id}>
                    <span className={`notification-type-icon type-${notification.type}`}><Icon size={16} /></span>
                    <div className="notification-card-content">
                      <div className="notification-card-heading"><h2>{notification.title}</h2><time dateTime={notification.createdAt}>{formatNotificationDate(notification.createdAt)}</time></div>
                      <p>{notification.message}</p>
                      <div className="notification-card-actions">
                        <NotificationDestination notification={notification} role={user?.role} onRead={markRead} />
                        {!notification.readAt && <button type="button" className="notification-mark-read" onClick={() => void markRead(notification._id)}><Check size={12} /> Mark read</button>}
                      </div>
                    </div>
                    {!notification.readAt && <span className="notification-unread-dot" aria-label="Unread" />}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="notifications-empty"><span><Bell size={20} /></span><h2>{filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}</h2><p>New ticket activity and important support updates will show up here.</p></div>
          )}
        </section>
        <footer className="notifications-footer"><span>© 2026 NEXA Support Desk</span><span><ShieldCheck size={12} /> Private to your workspace account</span></footer>
      </div>
    </main>
  )
}
