import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, LoaderCircle, Mic, MicOff, X } from 'lucide-react'
import { useAuth } from './useAuth.js'
import { microphoneErrorMessage, resolveVoiceCommand, speechRecognitionErrorMessage } from './voice-utils.js'
import './VoiceAssistant.css'

const greetings = [
  "Heeyyy! It's me, Stella! I was waiting for you!",
  'Hiii! Stella is here! What shall we do today?',
  "Hellooo! You called me? I'm so happy!",
]

function matchFriendlyCommand(transcript, role) {
  const command = transcript.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (/\b(hey stella|hello stella|hi stella|stella are you there)\b/.test(command)) return { action: 'welcome', message: greetings[Math.floor(Math.random() * greetings.length)] }
  if (/\b(thank you|thanks stella|love you)\b/.test(command)) return { action: 'respond', message: 'Awww thank you so much! You are so sweet! Hehe!' }
  if (/\b(bye|goodbye|see you)\b/.test(command)) return { action: 'respond', message: "Byeee! Come back soon, okay? I'll miss you!" }
  const routes = [
    [/\b(open contact|contact page|contact us)\b/, '/contact', "Yay! Opening your contact page... let's talk!"],
    [/\b(open home|homepage|where is my homepage|go home)\b/, '/', "Going home! Let's go back to our cozy homepage!"],
    [/\b(open about|about us|who are you)\b/, '/about', 'Ooo about us? Let me show you who we are!'],
    [/\b(features|what can you do|show features)\b/, '/features', 'I have so many cool features! Let me show you!'],
    [/\b(pricing|price|how much)\b/, '/pricing', 'Let me show you the pricing... super affordable!'],
    [/\b(dashboard|open dashboard|my dashboard)\b/, role ? `/${role}/dashboard` : '/login', 'Opening your dashboard! Everything is ready for you!'],
    [/\b(live chat|chat|talk to someone|support)\b/, ['customer', 'agent', 'supervisor', 'admin'].includes(role) ? `/${role}/chat` : '/login', 'Let\'s chat! Connecting you to live chat right now!'],
    [/\b(create ticket|new ticket|help me|i need help)\b/, role === 'customer' ? '/customer/tickets/new' : '/login', "Don't worry! I'll create a new ticket for you!"],
  ]
  const match = routes.find(([pattern]) => pattern.test(command))
  if (!match) return null
  const [, path, message] = match
  const requiresCustomerLogin = /\b(create ticket|new ticket|help me|i need help)\b/.test(command) && role !== 'customer'
  return { action: 'navigate', path, message, ...(requiresCustomerLogin ? { redirectTo: '/customer/tickets/new' } : {}) }
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export default function VoiceAssistant() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('')
  const [recognizedText, setRecognizedText] = useState('')
  const recognitionRef = useRef(null)
  const stateRef = useRef(state)
  const locationRef = useRef(location.pathname)
  const userRef = useRef(user)
  const logoutRef = useRef(logout)
  const startListeningRef = useRef(null)
  const cancelledRef = useRef(false)
  const listeningTimerRef = useRef(null)
  const voicesRef = useRef([])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined
    const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices() }
    loadVoices()
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
    if (!window.speechSynthesis.addEventListener) window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices)
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = (text, onEnd) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = 1.6
    utterance.rate = 0.95
    utterance.volume = 1
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices()
    utterance.voice = voices.find((voice) => ['Google UK English Female', 'Samantha', 'Female', 'Zira'].some((name) => voice.name.includes(name))) || voices[0] || null
    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    window.speechSynthesis.speak(utterance)
  }

  const clearListeningTimer = () => {
    if (listeningTimerRef.current !== null) {
      window.clearTimeout(listeningTimerRef.current)
      listeningTimerRef.current = null
    }
  }

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { locationRef.current = location.pathname }, [location.pathname])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { logoutRef.current = logout }, [logout])

  const dismiss = () => {
    cancelledRef.current = true
    clearListeningTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    window.speechSynthesis?.cancel()
    stateRef.current = 'idle'
    setState('idle')
    setMessage('')
    setRecognizedText('')
  }

  const finish = (nextState, nextMessage) => {
    stateRef.current = nextState
    setState(nextState)
    setMessage(nextMessage)
  }

  const executeCommand = async (transcript) => {
    const friendlyIntent = matchFriendlyCommand(transcript, userRef.current?.role)
    const intent = friendlyIntent || resolveVoiceCommand(transcript, userRef.current?.role)
    setRecognizedText(transcript)
    if (intent.action === 'welcome' || intent.action === 'respond') {
      stateRef.current = 'speaking'
      setState('speaking')
      setMessage(intent.message || intent.label)
      speak(intent.message || intent.label, () => finish(intent.action === 'welcome' ? 'welcome' : 'complete', intent.message || intent.label))
      return
    }
    if (intent.action === 'navigate') {
      navigate(intent.path || (userRef.current?.role ? `/${userRef.current.role}/dashboard` : '/login'), { state: intent.redirectTo ? { from: intent.redirectTo } : undefined })
      const response = intent.message || `${intent.label}.`
      stateRef.current = 'speaking'
      setState('speaking')
      setMessage(response)
      speak(response, () => finish('complete', response))
      return
    }
    if (intent.action === 'section') {
      if (locationRef.current !== '/') navigate(`/#${intent.section}`)
      window.setTimeout(() => {
        const section = document.getElementById(intent.section)
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' })
          finish('complete', `${intent.label}.`)
        } else {
          finish('error', `${intent.label} is not available on this page.`)
        }
      }, locationRef.current === '/' ? 0 : 150)
      return
    }
    if (intent.action === 'logout') {
      if (!userRef.current) {
        finish('error', 'You are already signed out.')
        return
      }
      try {
        await logoutRef.current()
        navigate('/login', { replace: true })
        finish('complete', 'You have been signed out.')
      } catch (error) {
        finish('error', error.response?.data?.message || 'Sign out failed. Please use the normal sign-out control.')
      }
      return
    }
    if (intent.action === 'unrecognized') {
      const response = "Oopsie! I didn't get that. Try saying open dashboard, or go to live chat?"
      stateRef.current = 'speaking'
      setState('speaking')
      setMessage(response)
      speak(response, () => finish('error', response))
      return
    }
    finish('unsupported', intent.label)
  }

  const startListening = async () => {
    if (stateRef.current === 'starting' || stateRef.current === 'listening') {
      cancelledRef.current = true
      clearListeningTimer()
      recognitionRef.current?.stop()
      recognitionRef.current = null
      finish('complete', 'Listening stopped. No command was run.')
      return
    }
    if (stateRef.current === 'processing' || stateRef.current === 'speaking') return
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      finish('unsupported', 'Voice commands are not supported in this browser. You can still use all navigation and controls normally.')
      return
    }
    if (!window.isSecureContext) {
      finish('unsupported', 'Voice control requires a secure connection. Open NEXA on HTTPS or localhost, then try again.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      finish('unsupported', 'This browser cannot request microphone access. Use the latest Chrome on HTTPS or localhost.')
      return
    }
    setRecognizedText('')
    cancelledRef.current = false
    finish('starting', 'Requesting microphone access…')
    let microphoneStream
    let startupPhase = 'microphone'
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      microphoneStream.getTracks().forEach((track) => track.stop())
      microphoneStream = null
      if (cancelledRef.current) {
        finish('idle', '')
        return
      }

      startupPhase = 'recognition'
      const recognition = new SpeechRecognition()
      recognition.lang = 'en-US'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.onstart = () => {
        finish('listening', 'Listening… speak a command now.')
        clearListeningTimer()
        listeningTimerRef.current = window.setTimeout(() => {
          if (stateRef.current !== 'listening') return
          cancelledRef.current = true
          recognition.stop()
          finish('error', 'No speech was detected. Move closer to your microphone and try again.')
        }, 12000)
      }
      recognition.onresult = async (event) => {
        clearListeningTimer()
        const transcript = event.results?.[0]?.[0]?.transcript?.trim()
        if (!transcript) {
          finish('error', 'I didn’t hear a command. Activate the microphone to try again.')
          return
        }
        finish('processing', 'Processing your command…')
        await new Promise((resolve) => window.setTimeout(resolve, 180))
        await executeCommand(transcript)
      }
      recognition.onerror = (event) => {
        clearListeningTimer()
        if (cancelledRef.current || (event.error === 'aborted' && stateRef.current === 'idle')) return
        finish('error', speechRecognitionErrorMessage(event.error))
      }
      recognition.onend = () => {
        clearListeningTimer()
        recognitionRef.current = null
        if (cancelledRef.current) return
        if (stateRef.current === 'starting') finish('error', 'Voice control did not start. Please try again.')
        else if (stateRef.current === 'listening') finish('error', 'Listening ended without a command. Move closer to your microphone and try again.')
      }
      recognitionRef.current = recognition
      recognition.start()
    } catch (error) {
      microphoneStream?.getTracks().forEach((track) => track.stop())
      recognitionRef.current = null
      clearListeningTimer()
      if (!cancelledRef.current) {
        finish('error', startupPhase === 'microphone'
          ? microphoneErrorMessage(error)
          : 'Chrome speech recognition could not start. Check microphone permissions and try again.')
      }
    }
  }

  useEffect(() => {
    startListeningRef.current = startListening
  })

  useEffect(() => {
    const onRequestVoice = () => startListeningRef.current?.()
    window.addEventListener('nexa:voice-start', onRequestVoice)
    return () => {
      window.removeEventListener('nexa:voice-start', onRequestVoice)
    }
  }, [])

  useEffect(() => () => {
    cancelledRef.current = true
    clearListeningTimer()
    recognitionRef.current?.stop()
  }, [])

  const statusTitle = {
    starting: 'Starting microphone',
    listening: 'Listening…',
    processing: 'Processing…',
    welcome: 'Welcome to NEXA',
    complete: 'Command executed',
    unsupported: 'Voice unavailable',
    error: 'Voice assistant',
  }[state]

  return (
    <>
      <button
        className={`voice-assistant-launcher${state === 'listening' ? ' is-listening' : ''}`}
        type="button"
        onClick={startListening}
        disabled={state === 'processing'}
        aria-label={state === 'listening' ? 'Stop voice assistant listening' : 'Start voice assistant'}
        aria-pressed={state === 'listening' || state === 'processing'}
      >
        {state === 'listening' ? <MicOff size={16} /> : state === 'processing' || state === 'speaking' ? <LoaderCircle size={16} className="voice-assistant-spin" /> : <Mic size={16} />}
        <span>{state === 'listening' ? 'Listening…' : 'Voice Assistant'}</span>
        <i className={`voice-launcher-state state-${state}`} />
      </button>
      {state !== 'idle' && (
        <section className={`voice-assistant-panel voice-panel-${state}`} aria-live="polite" aria-atomic="true" aria-label="Voice assistant status">
          <button className="voice-assistant-dismiss" type="button" onClick={dismiss} aria-label="Close voice assistant"><X size={15} /></button>
          <span className="voice-assistant-icon">
            {state === 'listening' ? <Mic size={17} /> : state === 'processing' || state === 'starting' || state === 'speaking' ? <LoaderCircle size={17} className="voice-assistant-spin" /> : state === 'complete' || state === 'welcome' ? <Check size={17} /> : <AlertTriangle size={17} />}
          </span>
          <div className="voice-assistant-copy">
            <strong>{statusTitle}</strong>
            {state === 'listening' && <span className="voice-assistant-waveform" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>}
            {recognizedText && <small className="voice-assistant-transcript">“{recognizedText}”</small>}
            <p>{message}</p>
            {(state === 'error' || state === 'unsupported' || state === 'complete' || state === 'welcome') && <button className="voice-assistant-retry" type="button" onClick={startListening}>Try another command <Mic size={12} /></button>}
          </div>
        </section>
      )}
    </>
  )
}
