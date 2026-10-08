import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorHandler, notFound } from './errorHandler.js'

function invokeErrorHandler(error) {
  const response = {
    headersSent: false,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
  errorHandler(error, {}, response, (nextError) => {
    response.nextError = nextError
  })
  return response
}

test('database availability errors return a retryable safe response', () => {
  const response = invokeErrorHandler(Object.assign(
    new Error('mongodb://user:secret@db.example.test timed out'),
    { name: 'MongoServerSelectionError' },
  ))
  assert.equal(response.statusCode, 503)
  assert.deepEqual(response.body, {
    message: 'NEXA is temporarily unable to reach its data service. Please try again shortly.',
  })
  assert.equal(JSON.stringify(response.body).includes('secret'), false)
})

test('duplicate key errors return a safe conflict response', () => {
  const response = invokeErrorHandler(Object.assign(new Error('duplicate private index details'), { code: 11000 }))
  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.body, { message: 'A record with this information already exists.' })
  assert.equal(JSON.stringify(response.body).includes('private'), false)
})

test('unexpected errors do not expose stack traces or server details', () => {
  const originalConsoleError = console.error
  let logged
  console.error = (...args) => { logged = args }
  try {
    const response = invokeErrorHandler(new Error('private database password and stack details'))
    assert.equal(response.statusCode, 500)
    assert.deepEqual(response.body, { message: 'Something went wrong. Please try again.' })
    assert.equal(JSON.stringify(response.body).includes('password'), false)
    assert.equal(JSON.stringify(response.body).includes('stack'), false)
  } finally {
    console.error = originalConsoleError
  }
  assert.deepEqual(logged, ['API request failed:', { name: 'Error', code: undefined }])
})

test('unknown API routes return a safe not-found message', () => {
  const response = {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
  notFound({}, response)
  assert.equal(response.statusCode, 404)
  assert.deepEqual(response.body, { message: 'The requested API route was not found.' })
})
