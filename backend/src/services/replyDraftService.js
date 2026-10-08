const maximumResponseBytes = 30 * 1024
const responseTimeoutMs = 30_000
const eligibleStatuses = ['pending', 'assigned_to_agent', 'escalated']

export function getDraftErrors({ text }) {
  if (typeof text !== 'string' || text.trim().length < 10 || text.trim().length > 2000) {
    return { text: 'Enter a reply between 10 and 2,000 characters.' }
  }
  return {}
}

export function validateDraftResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('AI draft provider returned an invalid response.')
  }
  const { reply, confidence, suggestedActions } = result
  const errors = getDraftErrors({ text: reply })
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    errors.confidence = 'AI draft provider must return confidence between 0 and 1.'
  }
  if (suggestedActions !== undefined && (
    !Array.isArray(suggestedActions)
    || suggestedActions.length > 5
    || suggestedActions.some((action) => typeof action !== 'string' || action.trim().length < 2 || action.trim().length > 120)
  )) {
    errors.suggestedActions = 'AI draft provider must return up to five short suggested actions.'
  }
  if (Object.keys(errors).length) {
    throw new Error(Object.values(errors)[0])
  }
  return {
    text: reply.trim(),
    confidence,
    suggestedActions: (suggestedActions || []).map((action) => action.trim()),
  }
}

async function readLimitedBody(response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maximumResponseBytes) {
      await reader.cancel()
      throw Object.assign(new Error('AI draft provider response exceeded the allowed size. No draft was saved.'), { statusCode: 502 })
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks).toString('utf8')
}

export class HttpReplyDraftProvider {
  constructor({ url, apiKey, fetchImpl = fetch }) {
    this.url = url
    this.apiKey = apiKey
    this.fetchImpl = fetchImpl
    this.provider = 'ai'
  }

  async generate(ticket) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), responseTimeoutMs)
    try {
      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          ticket: {
            subject: ticket.subject,
            description: ticket.description,
            category: ticket.category,
            priority: ticket.priority,
            messages: ticket.messages.slice(-20).map((message) => ({
              role: message.author?.role === 'customer' ? 'customer' : 'support',
              body: message.body,
            })),
          },
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw Object.assign(new Error(`AI draft provider returned HTTP ${response.status}. No draft was saved.`), { statusCode: 502 })
      }
      const declaredLength = Number(response.headers.get('content-length'))
      if (Number.isFinite(declaredLength) && declaredLength > maximumResponseBytes) {
        throw Object.assign(new Error('AI draft provider response exceeded the allowed size. No draft was saved.'), { statusCode: 502 })
      }
      const body = await readLimitedBody(response)
      let result
      try {
        result = JSON.parse(body)
      } catch {
        throw Object.assign(new Error('AI draft provider returned invalid JSON. No draft was saved.'), { statusCode: 502 })
      }
      try {
        return validateDraftResult(result)
      } catch (error) {
        throw Object.assign(new Error(`AI draft provider returned an invalid contract: ${error.message}`), { statusCode: 502 })
      }
    } catch (error) {
      if (error.statusCode) throw error
      if (error.name === 'AbortError') throw Object.assign(new Error('AI draft provider timed out. No draft was saved.'), { statusCode: 504 })
      throw Object.assign(new Error('AI draft provider could not be reached. No draft was saved.'), { statusCode: 502 })
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function createReplyDraftProvider(config, options = {}) {
  if (!config.draftProviderUrl) return { provider: 'unconfigured', generate: async () => {
    throw Object.assign(new Error('AI reply drafting is not configured. Enter a manual reply or configure AI_DRAFT_URL.'), { statusCode: 503 })
  } }
  return new HttpReplyDraftProvider({
    url: config.draftProviderUrl,
    apiKey: config.draftApiKey || '',
    ...options,
  })
}

export const replyDraftConstants = { eligibleStatuses }
