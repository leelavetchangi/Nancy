const supportRoles = ['agent', 'supervisor', 'admin']
const dayMs = 24 * 60 * 60 * 1000

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10)
}

export function buildAnalyticsReport(facets = {}, startDate, endDate) {
  const summary = facets.summary?.[0] || {}
  const dailyByDate = new Map((facets.daily || []).map((item) => [item._id, item]))
  const responseByDate = new Map((facets.responses || []).map((item) => [item._id, item]))
  const csatByDate = new Map((facets.csat || []).map((item) => [item._id, item]))
  const escalationByDate = new Map((facets.escalations || []).map((item) => [item._id, item]))
  const days = []

  for (let time = startDate.getTime(); time <= endDate.getTime(); time += dayMs) {
    const date = dayKey(time)
    const created = dailyByDate.get(date) || {}
    const response = responseByDate.get(date) || {}
    const rating = csatByDate.get(date) || {}
    const escalated = escalationByDate.get(date) || {}
    const total = created.total || 0
    const resolved = created.resolved || 0
    const escalationCount = escalated.escalated || 0
    days.push({
      date,
      tickets: total,
      resolved,
      aiResolved: created.aiResolved || 0,
      humanResolved: created.humanResolved || 0,
      resolutionRate: total ? Math.round((resolved / total) * 1000) / 10 : null,
      averageResponseMinutes: response.averageMs == null ? null : Math.round(response.averageMs / 6000) / 10,
      escalated: escalationCount,
      escalationRate: total ? Math.round((escalationCount / total) * 1000) / 10 : null,
      csat: rating.averageRating == null ? null : Math.round(rating.averageRating * 100) / 100,
      csatResponses: rating.responses || 0,
    })
  }

  const resolved = summary.resolved || 0
  const aiResolved = summary.aiResolved || 0
  const totalTickets = summary.total || 0
  const responseMs = facets.responseSummary?.[0]?.averageMs
  const rating = summary.averageRating

  return {
    range: { start: dayKey(startDate), end: dayKey(endDate) },
    summary: {
      totalTickets,
      resolvedTickets: resolved,
      resolutionRate: totalTickets ? Math.round((resolved / totalTickets) * 1000) / 10 : 0,
      aiResolvedTickets: aiResolved,
      humanResolvedTickets: Math.max(0, resolved - aiResolved),
      aiResolutionRate: resolved ? Math.round((aiResolved / resolved) * 1000) / 10 : 0,
      humanResolutionRate: resolved ? Math.round(((resolved - aiResolved) / resolved) * 1000) / 10 : 0,
      averageResponseMinutes: responseMs == null ? null : Math.round(responseMs / 60000 * 10) / 10,
      responseCount: facets.responseSummary?.[0]?.responses || 0,
      escalatedTickets: summary.escalated || 0,
      escalationRate: totalTickets ? Math.round((summary.escalated || 0) / totalTickets * 1000) / 10 : 0,
      customerSatisfaction: rating == null ? null : Math.round(rating * 100) / 100,
      csatResponses: summary.csatResponses || 0,
    },
    daily: days,
    topCategories: (facets.categories || []).map(({ _id, count }) => ({ category: _id, tickets: count })),
  }
}

export function createAnalyticsPipeline(startDate, endDate) {
  const isResolved = { $in: ['$status', ['resolved', 'closed']] }
  const hasAiApproval = { $ne: [{ $ifNull: ['$draftReply.approvedAt', null] }, null] }
  const ratingExpression = { $ifNull: [{ $arrayElemAt: ['$survey.rating', 0] }, '$csat.rating'] }
  const hasRating = { $isNumber: ratingExpression }
  const hasEscalation = {
    $or: [
      { $eq: ['$status', 'escalated'] },
      { $ne: [{ $ifNull: ['$escalatedAt', null] }, null] },
      { $ne: [{ $ifNull: ['$draftReply.escalatedAt', null] }, null] },
    ],
  }
  const dateExpression = (field) => ({
    $dateToString: { format: '%Y-%m-%d', date: field, timezone: 'UTC' },
  })
  const firstResponseStages = () => [
    { $unwind: '$messages' },
    {
      $lookup: {
        from: 'messages',
        localField: 'messages',
        foreignField: '_id',
        as: 'message',
      },
    },
    { $unwind: '$message' },
    {
      $lookup: {
        from: 'users',
        localField: 'message.author',
        foreignField: '_id',
        as: 'author',
      },
    },
    { $unwind: '$author' },
    { $match: { 'author.role': { $in: supportRoles } } },
    { $sort: { 'message.createdAt': 1 } },
    {
      $group: {
        _id: '$_id',
        createdAt: { $first: '$createdAt' },
        firstResponseAt: { $first: '$message.createdAt' },
      },
    },
  ]

  return [
    { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
    {
      $lookup: {
        from: 'csat_surveys',
        localField: '_id',
        foreignField: 'ticketId',
        as: 'survey',
      },
    },
    {
      $facet: {
        summary: [{
          $group: {
            _id: null,
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [isResolved, 1, 0] } },
            aiResolved: { $sum: { $cond: [{ $and: [isResolved, hasAiApproval] }, 1, 0] } },
            escalated: { $sum: { $cond: [hasEscalation, 1, 0] } },
            averageRating: { $avg: { $cond: [hasRating, ratingExpression, null] } },
            csatResponses: { $sum: { $cond: [hasRating, 1, 0] } },
          },
        }],
        daily: [{
          $group: {
            _id: dateExpression('$createdAt'),
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [isResolved, 1, 0] } },
            aiResolved: { $sum: { $cond: [{ $and: [isResolved, hasAiApproval] }, 1, 0] } },
          },
        }],
        categories: [
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 7 },
        ],
        responses: [
          ...firstResponseStages(),
          {
            $group: {
              _id: dateExpression('$createdAt'),
              averageMs: { $avg: { $subtract: ['$firstResponseAt', '$createdAt'] } },
              responses: { $sum: 1 },
            },
          },
        ],
        responseSummary: [
          ...firstResponseStages(),
          {
            $group: {
              _id: null,
              averageMs: { $avg: { $subtract: ['$firstResponseAt', '$createdAt'] } },
              responses: { $sum: 1 },
            },
          },
        ],
        csat: [
          { $match: { $expr: hasRating } },
          {
            $group: {
              _id: dateExpression('$createdAt'),
              averageRating: { $avg: ratingExpression },
              responses: { $sum: 1 },
            },
          },
        ],
        escalations: [
          { $match: { $expr: hasEscalation } },
          {
            $group: {
              _id: dateExpression('$createdAt'),
              escalated: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]
}
