import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createArticleSnippet,
  createKnowledgeRetrievalService,
  getArticleErrors,
} from './knowledgeRetrievalService.js'

test('knowledge articles require searchable titles, summaries, content, categories and bounded tags', () => {
  assert.deepEqual(getArticleErrors({
    title: 'Reset your account password',
    summary: 'Follow these steps to safely reset your password.',
    content: 'Open account settings, choose security, and request a password reset.',
    category: 'Account access',
    tags: ['password', 'account'],
  }), {})
  assert.deepEqual(Object.keys(getArticleErrors({
    title: 'x',
    summary: '',
    content: 'too short',
    category: '',
    tags: [''],
  })).sort(), ['category', 'content', 'summary', 'tags', 'title'])
  assert.equal(Object.keys(getArticleErrors(null)).length, 4)
})

test('knowledge snippets excerpt a keyword match without generating an answer', () => {
  const snippet = createArticleSnippet({
    summary: 'This guide covers account access.',
    content: `${'General information. '.repeat(12)}Use a password reset link to restore secure account access.`,
  }, 'password reset')
  assert.match(snippet, /password reset/i)
  assert.equal(snippet.length <= 262, true)
})

test('Mongo retrieval returns sources and explicitly leaves generative answers unconfigured', async () => {
  const calls = []
  const service = createKnowledgeRetrievalService({
    retriever: {
      popular: async () => [{ id: 'article-1' }],
      retrieve: async (query) => {
        calls.push(query)
        return [{ id: 'article-1', title: 'Reset password' }]
      },
      getPublishedArticle: async (id) => ({ id, title: 'Reset password' }),
    },
  })
  const result = await service.search('reset password')
  assert.deepEqual(calls, ['reset password'])
  assert.equal(result.retrievalProvider, 'mongodb-keyword')
  assert.equal(result.answerProvider, 'unconfigured')
  assert.equal(result.answer, null)
  assert.equal(result.sources.length, 1)
  assert.deepEqual(await service.popular(), [{ id: 'article-1' }])
})

test('an injected answer provider is called only as the configured RAG answerer', async () => {
  const service = createKnowledgeRetrievalService({
    retriever: {
      popular: async () => [],
      retrieve: async () => [{ id: 'source-1', title: 'Verified source', content: 'Retrieved article content.' }],
      getPublishedArticle: async () => null,
    },
    answerer: {
      provider: 'configured-llm',
      answer: async ({ query, sources }) => {
        assert.equal(query, 'account access')
        assert.equal(sources[0].id, 'source-1')
        assert.equal(sources[0].content, 'Retrieved article content.')
        return { text: 'A configured model answer.' }
      },
    },
  })
  const result = await service.search('account access')
  assert.equal(result.answerProvider, 'configured-llm')
  assert.equal(result.answer, 'A configured model answer.')
  assert.equal(Object.hasOwn(result.sources[0], 'content'), false)
})
