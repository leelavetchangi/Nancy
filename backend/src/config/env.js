import 'dotenv/config'

export function getConfig() {
  const mongoUri = process.env.MONGO_URI?.trim()
  const jwtSecret = process.env.JWT_SECRET
  const clientUrl = process.env.CLIENT_URL?.trim() || 'http://localhost:5173'
  const nodeEnv = process.env.NODE_ENV || 'development'
  const port = Number.parseInt(process.env.PORT || '5000', 10)
  const triageProviderUrl = process.env.AI_TRIAGE_URL?.trim() || ''
  const triageApiKey = process.env.AI_API_KEY?.trim() || ''
  const draftProviderUrl = process.env.AI_DRAFT_URL?.trim() || ''
  const draftApiKey = process.env.AI_DRAFT_API_KEY?.trim() || ''

  if (!mongoUri) {
    throw new Error('MONGO_URI is required. Copy .env.example to .env and configure MongoDB.')
  }
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.')
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.')
  }
  if (triageProviderUrl) {
    let providerUrl
    try {
      providerUrl = new URL(triageProviderUrl)
    } catch {
      throw new Error('AI_TRIAGE_URL must be a valid HTTPS URL.')
    }
    if (providerUrl.protocol !== 'https:' && nodeEnv === 'production') {
      throw new Error('AI_TRIAGE_URL must use HTTPS in production.')
    }
  }
  if (draftProviderUrl) {
    let providerUrl
    try {
      providerUrl = new URL(draftProviderUrl)
    } catch {
      throw new Error('AI_DRAFT_URL must be a valid HTTPS URL.')
    }
    if (providerUrl.protocol !== 'https:' && nodeEnv === 'production') {
      throw new Error('AI_DRAFT_URL must use HTTPS in production.')
    }
  }

  return {
    mongoUri,
    jwtSecret,
    clientUrl,
    port,
    triageProviderUrl,
    triageApiKey,
    draftProviderUrl,
    draftApiKey,
    nodeEnv,
  }
}
