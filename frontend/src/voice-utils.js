const spokenDigits = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
}

export function microphoneErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Allow microphone access for this site in Chrome settings, then try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found. Connect or enable a microphone, then try again.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The microphone is unavailable or being used by another app. Close other recording apps and try again.'
    case 'OverconstrainedError':
      return 'Chrome could not use the available microphone. Check your microphone settings and try again.'
    default:
      return 'The microphone could not be started. Check Chrome site permissions and your microphone, then try again.'
  }
}

export function speechRecognitionErrorMessage(error) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or speech recognition access was denied. Allow microphone access for this site in Chrome settings, then try again.'
    case 'no-speech':
      return 'No speech was detected. Move closer to your microphone and try again.'
    case 'audio-capture':
      return 'Chrome could not access a microphone. Connect or enable a microphone, then try again.'
    case 'network':
      return 'Chrome speech recognition could not reach its speech service. Check your internet connection and try again.'
    case 'language-not-supported':
      return 'English speech recognition is not available in this browser.'
    default:
      return 'Voice control could not start. Check Chrome microphone permissions and try again.'
  }
}

export function normalizeVoiceCommand(command) {
  return command.toLowerCase().replace(/[^\p{L}\p{N}#\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function ticketReference(command) {
  const match = command.match(/\b(?:ticket|case)\s+(?:number\s+)?(.+)$/u)
  if (!match) return null
  const words = match[1].trim().replace(/^#/, '').split(/\s+/)
  const candidate = words[0]
  const isSpokenNumber = Object.hasOwn(spokenDigits, candidate)
  const numberWords = []
  if (isSpokenNumber) {
    for (const word of words.slice(0, 6)) {
      if (!Object.hasOwn(spokenDigits, word)) break
      numberWords.push(word)
    }
  }
  const digits = numberWords.map((word) => spokenDigits[word]).join('')
  return digits.length >= 3 ? digits : candidate.replace(/-/g, '').toUpperCase()
}

export function resolveVoiceCommand(transcript, role) {
  let command = normalizeVoiceCommand(transcript)
  const rolePath = role ? `/${role}` : ''

  const wakeWordMatch = command.match(/^(?:hello(?: stella)?|hey(?: stella)?|hi(?: stella)?)(?:\s+|$)/u)
  if (wakeWordMatch) {
    command = command.slice(wakeWordMatch[0].length).trim()
    if (!command) return { action: 'welcome', label: 'Welcome to NEXA. How can I help you?' }
  }

  if (/\b(log ?out|sign ?out|logout)\b/.test(command)) return { action: 'logout' }
  if (/\b(create|new|submit)\b.*\bticket\b|\bticket\b.*\b(create|new)\b/.test(command)) {
    if (role === 'customer') return { action: 'navigate', path: '/customer/tickets/new', label: 'Create a new ticket' }
    if (!role) return { action: 'navigate', path: '/login', redirectTo: '/customer/tickets/new', label: 'Sign in to create a new ticket' }
    return { action: 'unavailable', label: 'Creating support tickets is available from the customer workspace.' }
  }
  if (/\b(high priority|priority high|show high|filter high)\b/.test(command)) {
    return {
      action: 'navigate',
      path: role === 'customer' ? '/customer/tickets?priority=high' : `${rolePath}/chat?priority=high`,
      label: 'Show high-priority tickets',
    }
  }

  const reference = ticketReference(command)
  if (reference) {
    return role === 'customer'
      ? { action: 'navigate', path: `/customer/tickets?ticket=${encodeURIComponent(reference)}`, label: `Open ticket ${reference}` }
      : ['agent', 'supervisor', 'admin'].includes(role)
        ? { action: 'navigate', path: `${rolePath}/chat?ticket=${encodeURIComponent(reference)}`, label: `Open ticket ${reference}` }
        : { action: 'unavailable', label: 'Ticket lookup requires a signed-in support workspace.' }
  }

  if (/\b(my tickets|tickets|ticket list)\b/.test(command)) {
    return role === 'customer'
      ? { action: 'navigate', path: '/customer/tickets', label: 'Open my tickets' }
      : ['agent', 'supervisor', 'admin'].includes(role)
        ? { action: 'navigate', path: `${rolePath}/chat`, label: 'Open the support ticket queue' }
        : { action: 'navigate', path: '/login', redirectTo: '/customer/tickets', label: 'Sign in to view your tickets' }
  }
  if (/\b(live chat|chat|conversations?)\b/.test(command)) {
    return ['customer', 'agent', 'supervisor', 'admin'].includes(role)
      ? { action: 'navigate', path: `${rolePath}/chat`, label: 'Open live chat' }
      : { action: 'navigate', path: '/login', label: 'Sign in to open live chat' }
  }
  if (/\b(triage|ai triage)\b/.test(command)) {
    return ['agent', 'supervisor', 'admin'].includes(role)
      ? { action: 'navigate', path: `${rolePath}/triage`, label: 'Open AI Triage Center' }
      : { action: 'unavailable', label: 'AI Triage Center is available to support staff.' }
  }
  if (/\b(draft reply|reply approval|ai reply)\b/.test(command)) {
    return ['agent', 'supervisor', 'admin'].includes(role)
      ? { action: 'navigate', path: `${rolePath}/draft-reply`, label: 'Open AI Draft Reply' }
      : { action: 'unavailable', label: 'AI Draft Reply is available to support staff.' }
  }
  if (/\b(analytics|reports?)\b/.test(command)) {
    return ['supervisor', 'admin'].includes(role)
      ? { action: 'navigate', path: `/${role}/analytics`, label: 'Open analytics' }
      : { action: 'unavailable', label: 'Supervisor analytics is available to supervisors and admins.' }
  }
  if (/\b(knowledge ?base|help center|help articles?)\b/.test(command)) {
    return ['customer', 'agent', 'supervisor', 'admin'].includes(role)
      ? { action: 'navigate', path: `/${role}/knowledge`, label: 'Open Knowledge Base' }
      : { action: 'navigate', path: '/login', label: 'Sign in to open the Knowledge Base' }
  }
  if (/\b(feedback|satisfaction survey|rate (?:my )?(?:support|ticket))\b/.test(command)) {
    return role === 'customer'
      ? { action: 'navigate', path: '/customer/csat', label: 'Open customer feedback survey' }
      : { action: 'unavailable', label: 'Customer feedback surveys are available from the customer workspace.' }
  }
  if (/\bnotifications?\b/.test(command)) {
    return ['customer', 'agent', 'supervisor', 'admin'].includes(role)
      ? { action: 'navigate', path: `${rolePath}/notifications`, label: 'Open notifications' }
      : { action: 'navigate', path: '/login', label: 'Sign in to view notifications' }
  }
  if (/\b(go to home|open home|home page|homepage|main page)\b/.test(command)) {
    return { action: 'navigate', path: '/', label: 'Go to home' }
  }
  if (/\b(dashboard|overview)\b/.test(command)) {
    return rolePath
      ? { action: 'navigate', path: `${rolePath}/dashboard`, label: 'Open dashboard' }
      : { action: 'navigate', path: '/login', label: 'Sign in to open your dashboard' }
  }
  if (/\bhome\b/.test(command)) return { action: 'navigate', path: '/', label: 'Go to home' }
  if (/\b(register|sign up|get started)\b/.test(command)) {
    return { action: 'navigate', path: '/register', label: 'Open registration' }
  }
  if (/\b(login|log in|sign in)\b/.test(command)) {
    return { action: 'navigate', path: '/login', label: 'Open login' }
  }
  if (/\b(features?|about|contact)\b/.test(command)) {
    const section = /\bfeatures?\b/.test(command) ? 'features' : /\babout\b/.test(command) ? 'about' : 'contact'
    return { action: 'navigate', path: `/${section}`, label: `Go to ${section}` }
  }
  if (/\b(profile|settings)\b/.test(command)) {
    return { action: 'unavailable', label: 'Profile and settings are not available in this workspace yet.' }
  }
  return { action: 'unrecognized', label: 'Command not recognized. Try “open dashboard”, “go to live chat”, or “create a new ticket”.' }
}
