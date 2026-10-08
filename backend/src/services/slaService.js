const responseTargets = {
  critical: 15 * 60 * 1000,
  high: 60 * 60 * 1000,
  medium: 4 * 60 * 60 * 1000,
  low: 24 * 60 * 60 * 1000,
}

export function getSlaDeadline(createdAt, priority) {
  const target = responseTargets[priority]
  if (!target) throw new Error(`Unsupported ticket priority for SLA calculation: ${priority}`)
  return new Date(new Date(createdAt).getTime() + target)
}

export function getSlaState(deadline, now = Date.now()) {
  const remainingMs = new Date(deadline).getTime() - new Date(now).getTime()
  if (remainingMs <= 0) return { state: 'overdue', remainingMs: 0 }
  const state = remainingMs <= 5 * 60 * 1000
    ? 'urgent'
    : remainingMs <= 15 * 60 * 1000
      ? 'at-risk'
      : 'on-track'
  return { state, remainingMs }
}

export const slaTargets = Object.freeze({ ...responseTargets })
