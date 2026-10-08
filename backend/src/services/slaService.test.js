import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSlaDeadline, getSlaState, slaTargets } from './slaService.js'

test('SLA deadlines use the configured target for each ticket priority', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z')
  assert.equal(getSlaDeadline(createdAt, 'critical').getTime(), createdAt.getTime() + slaTargets.critical)
  assert.equal(getSlaDeadline(createdAt, 'high').getTime(), createdAt.getTime() + slaTargets.high)
  assert.equal(getSlaDeadline(createdAt, 'medium').getTime(), createdAt.getTime() + slaTargets.medium)
  assert.equal(getSlaDeadline(createdAt, 'low').getTime(), createdAt.getTime() + slaTargets.low)
  assert.throws(() => getSlaDeadline(createdAt, 'unknown'), /Unsupported ticket priority/)
})

test('SLA urgency changes at the visible five- and fifteen-minute thresholds', () => {
  const now = Date.now()
  assert.deepEqual(getSlaState(new Date(now + 16 * 60 * 1000), now), { state: 'on-track', remainingMs: 16 * 60 * 1000 })
  assert.deepEqual(getSlaState(new Date(now + 15 * 60 * 1000), now), { state: 'at-risk', remainingMs: 15 * 60 * 1000 })
  assert.deepEqual(getSlaState(new Date(now + 5 * 60 * 1000), now), { state: 'urgent', remainingMs: 5 * 60 * 1000 })
  assert.deepEqual(getSlaState(new Date(now - 1), now), { state: 'overdue', remainingMs: 0 })
})
