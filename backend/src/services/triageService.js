const CATEGORIES = ['technical', 'billing', 'account', 'product', 'other']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const SENTIMENTS = ['positive', 'neutral', 'frustrated', 'negative']
const MAX_PROVIDER_RESPONSE_BYTES = 16 * 1024

const categorySignals = {
  technical: ['error', 'bug', 'crash', 'broken', 'not working', 'failed', 'failure', 'issue', 'technical', 'unable to'],
  billing: ['bill', 'billing', 'invoice', 'charge', 'charged', 'payment', 'refund', 'subscription', 'price'],
  account: ['account', 'password', 'login', 'log in', 'sign in', 'access', 'locked', 'reset', 'verification'],
  product: ['feature', 'product', 'dashboard', 'integration', 'workspace', 'settings', 'how do i'],
}

const prioritySignals = {
  critical: ['outage', 'data loss', 'security breach', 'cannot access any', 'production down', 'urgent'],
  high: ['blocked', 'urgent', 'as soon as possible', 'cannot work', 'business stopped', 'important'],
  medium: ['not working', 'issue', 'problem', 'error', 'help', 'unable to'],
  low: ['question', 'suggestion', 'when possible', 'feature request', 'how do i'],
}

const frustratedSignals = ['frustrated', 'angry', 'unacceptable', 'disappointed', 'still waiting', 'again', 'ridiculous']
const negativeSignals = ['broken', 'failed', 'lost', 'cancel', 'terrible', 'worst', 'never']
const positiveSignals = ['thank you', 'thanks', 'great', 'appreciate', 'love']

export class TriageProviderError extends Error {
  constructor(message, statusCode = 502) {
    super(message)
    this.name = 'TriageProviderError'
    this.statusCode = statusCode
  }
}

function matchScore(text, signals) {
  return signals.reduce((score, signal) => score + (text.includes(signal) ? 1 : 0), 0)
}

function selectBySignals(text, signalMap, fallback) {
  const entries = Object.entries(signalMap)
    .map(([value, signals]) => ({ value, score: matchScore(text, signals), signalCount: signals.length }))
    .sort((left, right) => right.score - left.score)
  const [best, second] = entries
  if (!best || best.score === 0) return { value: fallback, score: 0, signalCount: 0, margin: 0 }
  return { ...best, margin: best.score - (second?.score || 0) }
}

function buildRuleBasedResult(ticket) {
  const text = `${ticket.subject} ${ticket.description}`.toLowerCase()
  const category = selectBySignals(text, categorySignals, 'other')
  const priority = selectBySignals(text, prioritySignals, 'low')
  const frustratedCount = matchScore(text, frustratedSignals)
  const negativeCount = matchScore(text, negativeSignals)
  const positiveCount = matchScore(text, positiveSignals)
  const sentiment = frustratedCount > 0
    ? 'frustrated'
    : negativeCount > positiveCount
      ? 'negative'
      : positiveCount > negativeCount
        ? 'positive'
        : 'neutral'

  const categoryConfidence = category.score === 0
    ? 0.5
    : Math.min(0.96, 0.55 + Math.min(category.score, 2) * 0.13 + (category.margin > 0 ? 0.08 : 0))
  const priorityConfidence = priority.score === 0
    ? 0.5
    : Math.min(0.95, 0.56 + Math.min(priority.score, 2) * 0.12)
  const confidence = Number(Math.min(categoryConfidence, priorityConfidence).toFixed(2))
  const teams = {
    technical: 'Technical Support',
    billing: 'Billing Support',
    account: 'Account Support',
    product: 'Product Support',
    other: 'General Support',
  }

  return {
    provider: 'rules',
    category: category.value,
    priority: priority.value,
    sentiment,
    confidence,
    recommendedTeam: teams[category.value],
    rationale: category.score
      ? `Matched ${category.score} category signal${category.score === 1 ? '' : 's'} and ${priority.score} priority signal${priority.score === 1 ? '' : 's'}. This is a local keyword-rule preview, not an AI analysis.`
      : 'No category keywords matched. This local rule preview cannot determine the request type; a human should review it.',
  }
}

function validateTriageResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TriageProviderError('The triage provider returned an invalid result.')
  }
  const confidence = Number(value.confidence)
  if (
    !CATEGORIES.includes(value.category)
    || !PRIORITIES.includes(value.priority)
    || !SENTIMENTS.includes(value.sentiment)
    || !Number.isFinite(confidence)
    || confidence < 0
    || confidence > 1
    || typeof value.recommendedTeam !== 'string'
    || value.recommendedTeam.trim().length < 2
    || value.recommendedTeam.trim().length > 80
    || typeof value.rationale !== 'string'
    || value.rationale.trim().length < 2
    || value.rationale.trim().length > 500
  ) {
    throw new TriageProviderError('The triage provider returned fields outside the supported contract.')
  }
  return {
    provider: 'ai',
    category: value.category,
    priority: value.priority,
    sentiment: value.sentiment,
    confidence,
    recommendedTeam: value.recommendedTeam.trim(),
    rationale: value.rationale.trim(),
  }
}

export class RulesBasedTriageProvider {
  constructor() {
    this.provider = 'rules'
  }

  async analyze(ticket) {
    return buildRuleBasedResult(ticket)
  }
}

export class HttpTriageProvider {
  constructor({ url, apiKey, fetchImplementation = fetch }) {
    this.provider = 'ai'
    this.url = url
    this.apiKey = apiKey
    this.fetchImplementation = fetchImplementation
  }

  async analyze(ticket) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`
      const response = await this.fetchImplementation(this.url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          ticket: {
            subject: ticket.subject,
            description: ticket.description,
            category: ticket.category,
            priority: ticket.priority,
          },
        }),
      })
      const contentLength = Number(response.headers.get('content-length'))
      if (contentLength > MAX_PROVIDER_RESPONSE_BYTES) {
        throw new TriageProviderError('The triage provider response was too large.')
      }
      const reader = response.body?.getReader()
      if (!reader) throw new TriageProviderError('The triage provider returned an empty response.')
      const chunks = []
      let totalBytes = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > MAX_PROVIDER_RESPONSE_BYTES) {
          await reader.cancel()
          throw new TriageProviderError('The triage provider response was too large.')
        }
        chunks.push(value)
      }
      const responseText = new TextDecoder().decode(Buffer.concat(chunks))
      if (!response.ok) {
        throw new TriageProviderError(`The triage provider returned HTTP ${response.status}.`)
      }
      let parsed
      try {
        parsed = JSON.parse(responseText)
      } catch {
        throw new TriageProviderError('The triage provider did not return valid JSON.')
      }
      return validateTriageResult(parsed)
    } catch (error) {
      if (error instanceof TriageProviderError) throw error
      if (error.name === 'AbortError') {
        throw new TriageProviderError('The triage provider timed out. Please try again or review this ticket manually.', 504)
      }
      throw new TriageProviderError('The triage provider could not be reached. No analysis was saved.')
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function createTriageProvider(config) {
  if (config.triageProviderUrl) {
    return new HttpTriageProvider({ url: config.triageProviderUrl, apiKey: config.triageApiKey })
  }
  return new RulesBasedTriageProvider()
}

export function applyReviewDecision(result, minimumConfidence = 0.8) {
  return {
    ...result,
    reviewRequired: result.provider === 'rules' || result.confidence < minimumConfidence,
  }
}

export const triageConstants = {
  categories: CATEGORIES,
  priorities: PRIORITIES,
  sentiments: SENTIMENTS,
  minimumConfidence: 0.8,
}
