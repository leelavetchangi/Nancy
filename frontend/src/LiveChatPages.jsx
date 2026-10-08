import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  AudioWaveform,
  Bot,
  Check,
  CheckCheck,
  ChevronRight,
  FileText,
  Image,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
  UsersRound,
  X,
} from 'lucide-react'
import { roleDestination, roleLabels } from './auth-utils.js'
import { useAuth } from './useAuth.js'
import api from './api.js'
import './LiveChat.css'

const apiOrigin = api.defaults.baseURL.replace(/\/api\/?$/, '')
const quickReplies = [
  'Thanks for reaching out. I’m looking into this for you.',
  'I understand how frustrating this must be. Let me help.',
  'Could you share a little more detail so I can investigate?',
  'I’ve taken care of this. Please let me know if you need anything else.',
]

const ticketId = (ticket) => ticket?._id?.slice(-6).toUpperCase()
const formatTime = (value) => value ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : ''
const formatListTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return date.toDateString() === new Date().toDateString()
    ? formatTime(value)
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
}
const attachmentUrl = (ticket, attachment) => `${api.defaults.baseURL}/chat/tickets/${ticket._id}/attachments/${attachment._id}`

function NEXABrand() {
  return <Link className="brand livechat-brand" to="/" aria-label="NEXA home"><img className="brand-mark" src="/nexa-mark.svg" alt="" /><span className="brand-word">NEXA</span></Link>
}

function ChatSidebar({
  user, tickets, selectedId, unread, presence, searchText, onSearch, onSelect, loading,
  mobileOpen, onClose, onLogout, loggingOut, error, priorityFilter,
}) {
  const isCustomer = user?.role === 'customer'
  const filtered = tickets.filter((ticket) => {
    const otherName = isCustomer ? 'NEXA Support' : (ticket.customer?.fullName || '')
    return (!priorityFilter || ticket.priority === priorityFilter)
      && `${ticket.subject} ${otherName} ${ticket._id}`.toLowerCase().includes(searchText.toLowerCase())
  })
  return (
    <>
      {mobileOpen && <button className="chat-sidebar-scrim" type="button" aria-label="Close chat navigation" onClick={onClose} />}
      <aside className={`chat-sidebar${mobileOpen ? ' chat-sidebar-open' : ''}`}>
        <div className="chat-sidebar-brand-row"><NEXABrand /><button className="chat-mobile-close" type="button" onClick={onClose} aria-label="Close navigation"><X size={17} /></button></div>
        <div className="chat-workspace-card"><span className="chat-workspace-icon"><MessageCircle size={16} /></span><span><strong>Support Desk</strong><small>Live conversations</small></span><ChevronRight size={14} /></div>

        <div className="chat-side-section-heading"><span>CONVERSATIONS</span><span className="chat-count">{tickets.length}</span></div>
        <label className="chat-search"><Search size={14} /><input value={searchText} onChange={(event) => onSearch(event.target.value)} placeholder="Search tickets…" aria-label="Search conversations" /></label>

        <div className="chat-conversation-list" aria-label="Conversations">
          {loading ? <div className="chat-list-state"><span className="chat-spinner" /> Loading tickets…</div> : filtered.length ? filtered.map((ticket) => {
            const latest = ticket.messages?.at(-1)
            const otherId = isCustomer ? ticket.assignedAgent?._id : ticket.customer?._id
            const isOnline = otherId && presence[otherId]?.online
            const latestText = latest?.body || ticket.description || 'New support request'
            return (
              <button className={`chat-conversation-item${ticket._id === selectedId ? ' is-selected' : ''}`} type="button" key={ticket._id} onClick={() => { onSelect(ticket._id); onClose() }}>
                <span className={`chat-conversation-avatar${isCustomer ? ' avatar-agent' : ''}`}>
                  {isCustomer ? <Bot size={17} /> : (ticket.customer?.fullName?.[0]?.toUpperCase() || 'C')}
                  {isOnline && <i aria-label="Online" />}
                </span>
                <span className="chat-conversation-text">
                  <span className="chat-conversation-first"><strong>{isCustomer ? 'NEXA Support' : ticket.customer?.fullName || 'Customer'}</strong><time>{formatListTime(latest?.createdAt || ticket.updatedAt)}</time></span>
                  <span className="chat-conversation-subject">{ticket.subject}</span>
                  <span className="chat-conversation-preview">{latestText}</span>
                </span>
                {unread[ticket._id] > 0 && <span className="chat-unread-count">{unread[ticket._id]}</span>}
              </button>
            )
          }) : <div className="chat-list-state">{error ? 'Conversations unavailable.' : 'No open conversations found.'}</div>}
        </div>

        <div className="chat-sidebar-bottom">
          {!isCustomer && <div className="chat-team-presence"><span className="presence-stack"><i /><i /><i /></span><span><strong>Support team</strong><small>{Object.values(presence).filter((entry) => entry.online).length} online now</small></span></div>}
          <div className="chat-current-user"><span className="chat-user-avatar">{user?.fullName?.[0]?.toUpperCase() || 'N'}</span><span><strong>{user?.fullName}</strong><small>{roleLabels[user?.role] || 'NEXA member'}</small></span></div>
          <button className="chat-signout" type="button" onClick={onLogout} disabled={loggingOut}><LogOut size={14} />{loggingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>
    </>
  )
}

function ChatHeader({ ticket, user, online, onOpenMenu }) {
  const isCustomer = user?.role === 'customer'
  const contact = isCustomer ? ticket.assignedAgent : ticket.customer
  const name = isCustomer ? (contact?.fullName || 'NEXA Support Team') : (contact?.fullName || 'Customer')
  return (
    <header className="livechat-header">
      <button className="chat-mobile-menu" type="button" onClick={onOpenMenu} aria-label="Open conversations"><Menu size={19} /></button>
      <div className={`chat-header-avatar${isCustomer ? ' avatar-agent' : ''}`}>{isCustomer ? <Bot size={18} /> : (name[0]?.toUpperCase() || 'C')}<i className={online ? 'is-online' : ''} /></div>
      <div className="chat-header-contact"><strong>{name}</strong><span><i className={online ? 'is-online' : ''} />{online ? 'Online now' : (isCustomer ? 'Support team' : 'Customer')}</span></div>
      <div className="chat-header-ticket"><Ticket size={14} /><span>#{ticketId(ticket)}</span><i /><span>{ticket.subject}</span></div>
      <div className="chat-secure"><ShieldCheck size={13} /> SECURE</div>
    </header>
  )
}

function ChatAttachments({ message, ticket }) {
  return message.attachments?.map((attachment) => {
    const href = attachmentUrl(ticket, attachment)
    if (attachment.contentType.startsWith('audio/')) {
      return <audio className="chat-audio-attachment" controls preload="none" key={attachment._id} src={href} aria-label="Voice message" />
    }
    return (
      <a className="chat-file-attachment" href={href} key={attachment._id} target="_blank" rel="noreferrer" download={attachment.contentType === 'application/pdf'}>
        {attachment.contentType.startsWith('image/') ? <Image size={15} /> : <FileText size={15} />}
        <span><strong>{attachment.originalName}</strong><small>{(attachment.size / 1024).toFixed(0)} KB · open attachment</small></span>
      </a>
    )
  })
}

function ChatMessage({ message, ticket, currentUserId }) {
  const isOwn = String(message.author?._id || message.author) === String(currentUserId)
  return (
    <article className={`chat-message${isOwn ? ' chat-message-own' : ''}`} aria-label={`${isOwn ? 'You' : message.author?.fullName || 'Support'} at ${formatTime(message.createdAt)}`}>
      {!isOwn && <span className="chat-message-avatar">{message.author?.fullName?.[0]?.toUpperCase() || 'N'}</span>}
      <div className="chat-message-stack">
        {!isOwn && <span className="chat-message-author">{message.author?.fullName || 'NEXA Support'}</span>}
        <div className="chat-message-bubble">
          {message.body && message.body !== 'Shared an attachment' && message.body !== 'Voice message' && <p>{message.body}</p>}
          <ChatAttachments message={message} ticket={ticket} />
        </div>
        <div className="chat-message-meta"><time>{formatTime(message.createdAt)}</time>{isOwn && (message.readAt ? <><CheckCheck size={13} className="chat-read-icon" /><span>Read</span></> : <><Check size={12} /><span>Sent</span></>)}</div>
      </div>
    </article>
  )
}

function ChatComposer({
  text, onTextChange, onSend, disabled, typing, quickReply, onAttach,
  onStartVoice, onStopVoice, recording, sending, onSuggestion, suggesting, isStaff,
}) {
  const inputRef = useRef(null)
  const attachRef = useRef(null)
  const handleSubmit = (event) => {
    event.preventDefault()
    onSend()
  }
  return (
    <footer className="chat-composer-area">
      {typing && <div className="chat-typing-indicator" aria-live="polite"><span><i /><i /><i /></span>{typing} is typing…</div>}
      <div className="chat-quick-replies" aria-label="Quick replies">
        {quickReplies.slice(0, 3).map((reply) => <button type="button" key={reply} onClick={() => { quickReply(reply); inputRef.current?.focus() }}>{reply.length > 41 ? `${reply.slice(0, 38)}…` : reply}</button>)}
        <button className="chat-quick-more" type="button" onClick={() => quickReply(quickReplies[3])} title={quickReplies[3]} aria-label="Insert resolution quick reply"><Plus size={12} /></button>
      </div>
      {isStaff && <button className="chat-ai-suggest" type="button" onClick={onSuggestion} disabled={disabled || suggesting}><Sparkles size={13} />{suggesting ? 'Preparing suggestion…' : 'AI suggestion'}<span>Human review required</span></button>}
      <form className="chat-compose" onSubmit={handleSubmit}>
        <input ref={attachRef} className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,audio/webm,audio/mp4" onChange={(event) => { const file = event.target.files?.[0]; if (file) onAttach(file); event.target.value = '' }} />
        <button className="chat-tool-button" type="button" onClick={() => attachRef.current?.click()} disabled={disabled} aria-label="Attach a file"><Paperclip size={17} /></button>
        <textarea ref={inputRef} value={text} onChange={(event) => onTextChange(event.target.value)} placeholder="Message the support team…" rows={1} maxLength={2000} disabled={disabled} aria-label="Chat message" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() } }} />
        {recording
          ? <button className="chat-record-button is-recording" type="button" onClick={onStopVoice} aria-label="Stop recording voice message"><AudioWaveform size={17} /><span className="chat-record-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span><span>Stop</span></button>
          : <button className="chat-tool-button" type="button" onClick={onStartVoice} disabled={disabled} aria-label="Record voice message"><Mic size={17} /></button>}
        <button className="chat-send-button" type="submit" disabled={disabled || sending || !text.trim()} aria-label="Send message">{sending ? <LoaderCircle size={16} className="chat-spin" /> : <Send size={16} />}</button>
      </form>
      <div className="chat-composer-foot"><span><ShieldCheck size={11} /> Secure conversation · messages are saved to this ticket</span><span>{text.length}/2,000</span></div>
    </footer>
  )
}

export function LiveChatPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [tickets, setTickets] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [currentTicket, setCurrentTicket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [participants, setParticipants] = useState([])
  const [joinedTicketId, setJoinedTicketId] = useState('')
  const [presence, setPresence] = useState({})
  const [unread, setUnread] = useState({})
  const [searchText, setSearchText] = useState('')
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState('')
  const endRef = useRef(null)
  const typingTimer = useRef(null)
  const recorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const chunksRef = useRef([])
  const socketRef = useRef(null)
  const selectedIdRef = useRef('')
  const isStaff = user?.role !== 'customer'
  const searchParams = new URLSearchParams(location.search)
  const priorityFilter = searchParams.get('priority')?.toLowerCase()
  const requestedTicketId = searchParams.get('ticket')?.replace(/[^a-z0-9]/gi, '').toUpperCase()
  const currentOnline = useMemo(() => {
    const peer = participants.find((person) => String(person.id) !== String(user?.id))
    return peer ? Boolean(presence[peer.id]?.online ?? true) : false
  }, [participants, presence, user?.id])
  const displayedTicket = currentTicket?._id === selectedId ? currentTicket : null
  const typingName = typing?.ticketId === selectedId ? typing.fullName : ''

  const appendMessage = useCallback((message) => {
    setCurrentTicket((current) => {
      if (!current || current._id !== selectedIdRef.current) return current
      if (current.messages.some((item) => item._id === message._id)) return current
      return { ...current, messages: [...current.messages, message] }
    })
    setTickets((current) => current.map((ticket) => ticket._id === selectedIdRef.current
      ? { ...ticket, messages: [message], updatedAt: message.createdAt }
      : ticket))
  }, [])

  const loadTickets = useCallback(async () => {
    setError('')
    try {
      const { data } = await api.get('/chat/tickets')
      setTickets(data.tickets)
      setSelectedId((current) => data.tickets.some((ticket) => ticket._id === current) ? current : data.tickets[0]?._id || '')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load conversations. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/chat/tickets')
      .then(({ data }) => {
        if (!active) return
        setTickets(data.tickets)
        if (requestedTicketId) {
          const match = data.tickets.find((item) => item._id.toUpperCase().endsWith(requestedTicketId)
            || item._id.slice(-6).toUpperCase() === requestedTicketId)
          if (match) setSelectedId(match._id)
          else setError(`Ticket ${requestedTicketId} was not found in the support queue.`)
        } else {
          setSelectedId((current) => data.tickets.some((ticket) => ticket._id === current) ? current : data.tickets[0]?._id || '')
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load conversations. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [location.search, requestedTicketId])

  useEffect(() => {
    const client = io(apiOrigin, { withCredentials: true, autoConnect: true, transports: ['websocket', 'polling'] })
    socketRef.current = client
    client.on('connect', () => { setConnected(true); setError('') })
    client.on('disconnect', () => setConnected(false))
    client.on('connect_error', (connectError) => {
      setConnected(false)
      setError(connectError.message || 'Live chat connection failed. Please sign in again.')
    })
    client.on('chat:message', ({ ticketId: changedTicketId, message }) => {
      if (changedTicketId === selectedIdRef.current) {
        appendMessage(message)
        client.emit('chat:mark-read', { ticketId: changedTicketId })
      } else {
        setUnread((current) => ({ ...current, [changedTicketId]: (current[changedTicketId] || 0) + 1 }))
        setNotification('New message received.')
      }
      setTickets((current) => current.map((ticket) => ticket._id === changedTicketId
        ? { ...ticket, messages: [message], updatedAt: message.createdAt }
        : ticket))
    })
    client.on('chat:notification', ({ ticketId: changedTicketId }) => {
      if (changedTicketId !== selectedIdRef.current) {
        setUnread((current) => ({ ...current, [changedTicketId]: (current[changedTicketId] || 0) + 1 }))
        setNotification('New message received.')
      }
      loadTickets()
    })
    client.on('chat:typing', ({ ticketId: changedTicketId, user: typingUser, typing: isTyping }) => {
      if (changedTicketId !== selectedIdRef.current || typingUser?.id === user?.id) return
      setTyping(isTyping ? { ticketId: changedTicketId, fullName: typingUser.fullName } : null)
    })
    client.on('chat:participant-joined', ({ user: participant }) => {
      setParticipants((current) => current.some((item) => item.id === participant.id) ? current : [...current, participant])
      setPresence((current) => ({ ...current, [participant.id]: { ...participant, online: true } }))
    })
    client.on('chat:participant-left', ({ userId }) => {
      setParticipants((current) => current.filter((item) => item.id !== userId))
      setPresence((current) => ({ ...current, [userId]: { ...current[userId], online: false } }))
    })
    client.on('chat:read', ({ ticketId: changedTicketId, readerId, readAt }) => {
      if (changedTicketId !== selectedIdRef.current || readerId === user?.id) return
      setCurrentTicket((current) => current ? ({
        ...current,
        messages: current.messages.map((message) => String(message.author?._id || message.author) === String(user?.id) && !message.readAt
          ? { ...message, readAt }
          : message),
      }) : current)
    })
    return () => {
      if (selectedIdRef.current) client.emit('chat:leave', { ticketId: selectedIdRef.current })
      client.removeAllListeners()
      client.disconnect()
      socketRef.current = null
      if (typingTimer.current) window.clearTimeout(typingTimer.current)
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [appendMessage, loadTickets, user?.id])

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) {
      return undefined
    }
    let active = true
    api.get(`/chat/tickets/${selectedId}`)
      .then(({ data }) => {
        if (active) {
          setCurrentTicket(data.ticket)
          setUnread((current) => ({ ...current, [selectedId]: 0 }))
        }
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load this conversation.') })
    return () => { active = false }
  }, [selectedId])

  useEffect(() => {
    const activeSocket = socketRef.current
    if (!activeSocket || !connected || !selectedId) return undefined
    let active = true
    activeSocket.emit('chat:join', { ticketId: selectedId }, (result) => {
      if (!active) return
      if (result?.error) {
        setError(result.error)
        return
      }
      setParticipants(result.participants || [])
      setJoinedTicketId(selectedId)
      for (const participant of result.participants || []) {
        setPresence((current) => ({ ...current, [participant.id]: { ...participant, online: true } }))
      }
      activeSocket.emit('chat:mark-read', { ticketId: selectedId })
    })
    return () => {
      active = false
      activeSocket.emit('chat:leave', { ticketId: selectedId })
    }
  }, [connected, selectedId])

  useEffect(() => {
    if (displayedTicket) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [displayedTicket, typingName])

  const sendMessage = () => {
    const activeSocket = socketRef.current
    if (!text.trim() || sending || !activeSocket || !connected || !selectedId) return
    const body = text.trim()
    setSending(true)
    setError('')
    activeSocket.timeout(8000).emit('chat:send', { ticketId: selectedId, body }, (timeoutError, result) => {
      setSending(false)
      if (timeoutError) return setError('The message did not reach the chat server. Please try again.')
      if (result?.error) return setError(result.error)
      setText('')
      activeSocket.emit('chat:typing-stop', { ticketId: selectedId })
    })
  }

  const onTextChange = (value) => {
    const activeSocket = socketRef.current
    setText(value.slice(0, 2000))
    if (!activeSocket || !connected || !selectedId) return
    activeSocket.emit('chat:typing-start', { ticketId: selectedId })
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => activeSocket.emit('chat:typing-stop', { ticketId: selectedId }), 900)
  }

  const uploadAttachment = async (file) => {
    const activeSocket = socketRef.current
    if (!selectedId || uploading || !activeSocket || !connected) return
    if (file.size > 2 * 1024 * 1024) return setError('Attachments and voice messages must be smaller than 2 MB.')
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('attachment', file)
    try {
      const { data } = await api.post(`/chat/tickets/${selectedId}/attachments`, formData)
      setCurrentTicket(data.ticket)
      setTickets((current) => current.map((item) => item._id === data.ticket._id ? { ...item, messages: [data.message], updatedAt: data.ticket.updatedAt } : item))
      activeSocket.emit('chat:mark-read', { ticketId: selectedId })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to upload this attachment.')
    } finally {
      setUploading(false)
    }
  }

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported by this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'
        void uploadAttachment(new File([blob], `voice-message.${extension}`, { type: blob.type }))
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        recorderRef.current = null
        setRecording(false)
      }
      recorder.start()
      setRecording(true)
      setError('')
    } catch {
      setError('Microphone access was denied or unavailable. Check your browser permissions.')
    }
  }

  const stopVoiceRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const requestAiSuggestion = async () => {
    if (!selectedId || suggesting) return
    setSuggesting(true)
    setError('')
    try {
      const { data } = await api.post(`/ai/replies/tickets/${selectedId}/generate`, {}, { timeout: 35_000 })
      const suggestion = data.ticket.draftReply?.text
      if (!suggestion) throw new Error('The AI provider returned an empty suggestion.')
      setText(suggestion)
      setNotification('AI suggestion ready. Review and edit it before sending.')
      window.setTimeout(() => setNotification(''), 4500)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to prepare an AI suggestion.')
    } finally {
      setSuggesting(false)
    }
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

  return (
    <div className="livechat-app">
      <ChatSidebar
        user={user}
        tickets={tickets}
        selectedId={selectedId}
        unread={unread}
        presence={presence}
        searchText={searchText}
        onSearch={setSearchText}
        onSelect={setSelectedId}
        loading={loading}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        error={error}
        priorityFilter={priorityFilter}
      />
      <main className="livechat-main">
        {displayedTicket ? (
          <>
            <ChatHeader ticket={displayedTicket} user={user} online={joinedTicketId === selectedId && currentOnline} onOpenMenu={() => setMobileOpen(true)} />
            <div className="chat-topic-banner">
              <span className="chat-topic-icon"><Ticket size={14} /></span>
              <span><small>SUPPORT REQUEST</small><strong>{displayedTicket.subject}</strong></span>
              <span className={`chat-status-badge chat-status-${displayedTicket.status}`}>{displayedTicket.status.replaceAll('_', ' ')}</span>
              <span className="chat-topic-priority">{displayedTicket.priority}</span>
            </div>
            <div className="chat-message-area" aria-label="Ticket conversation" aria-live="polite">
              <div className="chat-day-divider"><span /><small>CONVERSATION STARTED</small><span /></div>
              <div className="chat-ticket-origin">
                <span><Ticket size={13} /> Ticket #{ticketId(displayedTicket)} created · {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(displayedTicket.createdAt))}</span>
                <p>{displayedTicket.description}</p>
              </div>
              {displayedTicket.messages?.map((message) => <ChatMessage key={message._id} message={message} ticket={displayedTicket} currentUserId={user?.id} />)}
              <div ref={endRef} />
            </div>
            {notification && <div className="chat-toast" role="status"><Check size={14} />{notification}<button type="button" onClick={() => setNotification('')} aria-label="Dismiss notification"><X size={13} /></button></div>}
            {error && <div className="chat-error" role="alert"><AlertTriangle size={14} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={13} /></button></div>}
            {uploading && <div className="chat-upload-progress" role="status"><LoaderCircle size={14} className="chat-spin" /> Uploading secure attachment…</div>}
            <ChatComposer
              text={text}
              onTextChange={onTextChange}
              onSend={sendMessage}
              disabled={!connected || displayedTicket.status === 'closed'}
              typing={typingName}
              quickReply={(value) => setText(value)}
              onAttach={uploadAttachment}
              onStartVoice={startVoiceRecording}
              onStopVoice={stopVoiceRecording}
              recording={recording}
              sending={sending}
              onSuggestion={requestAiSuggestion}
              suggesting={suggesting}
              isStaff={isStaff && displayedTicket.status !== 'resolved'}
            />
          </>
        ) : (
          <div className="chat-empty-workspace">
            <header className="livechat-header chat-empty-header"><button className="chat-mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open conversations"><Menu size={19} /></button><span className={`chat-connection-status${connected ? ' is-connected' : ''}`}><i />{connected ? 'LIVE CHAT CONNECTED' : 'CONNECTING TO LIVE CHAT'}</span></header>
            <div className="chat-empty-content">
              <div className="chat-empty-orbit"><span><AudioLines size={28} /></span><i /><i /><i /></div>
              <p className="chat-eyebrow"><span /> NEXA LIVE SUPPORT</p>
              <h1>{loading ? 'Connecting your workspace…' : 'Every conversation, in sync.'}</h1>
              <p>{loading ? 'Loading your open support tickets.' : error ? 'There was a problem connecting to chat. You can retry the conversation list.' : 'Choose a ticket to open its real-time conversation, or create a support ticket to get started.'}</p>
              {!loading && error && <button className="chat-retry-button" type="button" onClick={loadTickets}><ArrowLeft size={14} /> Retry conversations</button>}
              {!loading && !error && tickets.length === 0 && <Link className="chat-empty-action" to={user?.role === 'customer' ? { pathname: '/customer/tickets/new', state: { returnToLiveChat: true } } : roleDestination(user?.role)}>{user?.role === 'customer' ? 'Create a support ticket' : 'Back to workspace'} <ChevronRight size={15} /></Link>}
              <div className="chat-feature-list"><span><UsersRound size={14} /> Live presence</span><span><ShieldCheck size={14} /> Secure &amp; persistent</span><span><AudioWaveform size={14} /> Voice ready</span></div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
