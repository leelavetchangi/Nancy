import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createReplyDraftProvider,
  getDraftErrors,
  HttpReplyDraftProvider,
  validateDraftResult,
} from './replyDraftService.js'

const sampleResult = {
  reply: 'I’m sorry you’re having trouble signing in. I can help you restore access.',
  confidence: 0.93,
  suggestedActions: ['Confirm the account email address', 'Offer a secure password reset link'],
}

test('reply draft validation enforces the text length and provider contract', () => {
  assert.deepEqual(getDraftErrors({ text: '  ' }), { text: 'Enter a reply between 10 and 2,000 characters.' })
  assert.deepEqual(getDraftErrors({ text: 'A clear support response.' }), {})
  assert.deepEqual(validateDraftResult(sampleResult), {
    text: sampleResult.reply,
    confidence: 0.93,
    suggestedActions: sampleResult.suggestedActions,
  })
  assert.throws(() => validateDraftResult({ ...sampleResult, confidence: 1.2 }), /confidence between 0 and 1/)
  assert.throws(() => validateDraftResult({ ...sampleResult, suggestedActions: ['x'] }), /up to five short suggested actions/)
})

test('configured reply provider sends ticket context and returns a validated AI result', async () => {
  const provider = new HttpReplyDraftProvider({
    url: 'https://draft.example.test/reply',
    apiKey: 'provider-secret',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://draft.example.test/reply')
      assert.equal(options.headers.Authorization, 'Bearer provider-secret')
      const body = JSON.parse(options.body)
      assert.equal(body.ticket.subject, 'Cannot sign in')
      assert.equal(body.ticket.messages[0].role, 'customer')
      return new Response(JSON.stringify(sampleResult), { status: 200 })
    },
  })
  const result = await provider.generate({
    subject: 'Cannot sign in',
    description: 'The sign-in page rejects my password.',
    category: 'account',
    priority: 'high',
    messages: [{ body: 'I still cannot get in.', author: { role: 'customer' } }],
  })
  assert.equal(result.confidence, 0.93)
})

test('missing AI provider reports an explicit configuration error', async () => {
  const provider = createReplyDraftProvider({})
  assert.equal(provider.provider, 'unconfigured')
  await assert.rejects(provider.generate({}), {
    statusCode: 503,
    message: 'AI reply drafting is not configured. Enter a manual reply or configure AI_DRAFT_URL.',
  })
})

test('invalid AI provider contract fails without a simulated-draft fallback', async () => {
  const provider = new HttpReplyDraftProvider({
    url: 'https://draft.example.test/reply',
    fetchImpl: async () => new Response(JSON.stringify({ ...sampleResult, reply: 'Short' }), { status: 200 }),
  })
  await assert.rejects(
    provider.generate({ subject: 'Question', description: 'Details', messages: [] }),
    { statusCode: 502, message: /invalid contract/ },
  )
})
