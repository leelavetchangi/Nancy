import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAnalyticsReport, createAnalyticsPipeline } from './analyticsService.js'

test('analytics report derives rates from MongoDB aggregates and keeps missing data empty', () => {
  const start = new Date('2026-10-01T00:00:00.000Z')
  const end = new Date('2026-10-03T00:00:00.000Z')
  const report = buildAnalyticsReport({
    summary: [{
      total: 4,
      resolved: 2,
      aiResolved: 1,
      escalated: 1,
      averageRating: 4.5,
      csatResponses: 2,
    }],
    daily: [{ _id: '2026-10-01', total: 2, resolved: 1, aiResolved: 1 }],
    responses: [{ _id: '2026-10-01', averageMs: 90_000, responses: 1 }],
    responseSummary: [{ averageMs: 120_000, responses: 2 }],
    csat: [{ _id: '2026-10-01', averageRating: 4.5, responses: 2 }],
    escalations: [{ _id: '2026-10-01', escalated: 1 }],
    categories: [{ _id: 'technical', count: 3 }],
  }, start, end)

  assert.equal(report.summary.totalTickets, 4)
  assert.equal(report.summary.resolutionRate, 50)
  assert.equal(report.summary.aiResolutionRate, 50)
  assert.equal(report.summary.humanResolutionRate, 50)
  assert.equal(report.summary.averageResponseMinutes, 2)
  assert.equal(report.summary.customerSatisfaction, 4.5)
  assert.equal(report.daily.length, 3)
  assert.equal(report.daily[0].resolutionRate, 50)
  assert.equal(report.daily[0].averageResponseMinutes, 1.5)
  assert.equal(report.daily[0].escalated, 1)
  assert.equal(report.daily[1].tickets, 0)
  assert.equal(report.daily[1].resolutionRate, null)
  assert.equal(report.daily[1].csat, null)
  assert.deepEqual(report.topCategories, [{ category: 'technical', tickets: 3 }])
})

test('analytics query aggregates ticket history and first support response from MongoDB', () => {
  const pipeline = createAnalyticsPipeline(new Date('2026-10-01T00:00:00.000Z'), new Date('2026-10-08T00:00:00.000Z'))
  const facets = pipeline.at(-1).$facet
  assert.ok(facets.summary)
  assert.ok(facets.daily)
  assert.ok(facets.categories)
  assert.ok(facets.responses.some((stage) => stage.$lookup?.from === 'messages'))
  assert.ok(facets.responses.some((stage) => stage.$lookup?.from === 'users'))
  assert.ok(facets.csat)
  assert.ok(facets.escalations)
  assert.equal(pipeline[1].$lookup.from, 'csat_surveys')
  assert.equal(pipeline[0].$match.createdAt.$gte.toISOString(), '2026-10-01T00:00:00.000Z')
})
