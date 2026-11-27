import { schemas } from '@polar-sh/client'
import { startOfMonth, subMonths } from 'date-fns'

export const DAY_MS = 24 * 60 * 60 * 1000

export type TimelineSubscription = Pick<
  schemas['Subscription'],
  | 'status'
  | 'recurring_interval'
  | 'recurring_interval_count'
  | 'current_period_start'
  | 'current_period_end'
  | 'trial_start'
  | 'trial_end'
  | 'started_at'
  | 'ends_at'
  | 'ended_at'
  | 'paused_at'
  | 'resumes_at'
  | 'pause_at_period_end'
>

export type TimelineSegmentKind =
  | 'trial'
  | 'past'
  | 'current'
  | 'upcoming'
  | 'paused'

export interface TimelineSegment {
  kind: TimelineSegmentKind
  start: number
  end: number
}

export type TimelineMarkerKind =
  | 'ended'
  | 'ending'
  | 'pausing'
  | 'paused'
  | 'resuming'

export interface SubscriptionTimeline {
  start: number
  segments: TimelineSegment[]
  marker: { kind: TimelineMarkerKind; at: number } | null
}

interface TimelineOptions {
  now: number
  horizon: number
  minCycleDuration?: number
}

const MAX_CYCLES = 5000

const RENEWING_STATUSES = new Set<schemas['SubscriptionStatus']>([
  'active',
  'trialing',
  'past_due',
])

// Billing cycles are computed in UTC, clamping to the last day of short months.
const addUTCMonths = (time: number, months: number): number => {
  const date = new Date(time)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate()
  date.setUTCDate(Math.min(day, daysInMonth))
  return date.getTime()
}

const INTERVAL_ADDERS: Record<
  schemas['RecurringInterval'],
  (time: number, amount: number) => number
> = {
  day: (time, amount) => time + amount * DAY_MS,
  week: (time, amount) => time + amount * 7 * DAY_MS,
  month: addUTCMonths,
  year: (time, amount) => addUTCMonths(time, amount * 12),
}

const toTime = (value: string | null | undefined): number | null =>
  value ? new Date(value).getTime() : null

const getCycleEdges = (
  subscription: TimelineSubscription,
  from: number,
  to: number,
): number[] => {
  if (to <= from) {
    return []
  }
  const add = INTERVAL_ADDERS[subscription.recurring_interval]
  const step = Math.max(1, subscription.recurring_interval_count)
  const periodStart = new Date(subscription.current_period_start).getTime()
  const periodEnd = new Date(subscription.current_period_end).getTime()

  const before: number[] = []
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    const edge = add(periodStart, -cycle * step)
    if (edge <= from) break
    before.push(edge)
  }
  const after: number[] = []
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    const edge = add(periodEnd, cycle * step)
    if (edge >= to) break
    after.push(edge)
  }

  const inner = [...before.reverse(), periodStart, periodEnd, ...after].filter(
    (edge) => edge > from && edge < to,
  )

  return [from, ...inner, to]
}

const mergeSameKind = (segments: TimelineSegment[]): TimelineSegment[] =>
  segments.reduce<TimelineSegment[]>((merged, segment) => {
    const previous = merged.at(-1)
    if (previous && previous.kind === segment.kind) {
      previous.end = segment.end
    } else {
      merged.push({ ...segment })
    }
    return merged
  }, [])

export const getSubscriptionTimeline = (
  subscription: TimelineSubscription,
  { now, horizon, minCycleDuration = 0 }: TimelineOptions,
): SubscriptionTimeline => {
  const startedAt = new Date(subscription.started_at).getTime()
  const start = Math.min(
    startedAt,
    toTime(subscription.trial_start) ?? startedAt,
  )
  const periodStart = new Date(subscription.current_period_start).getTime()
  const periodEnd = new Date(subscription.current_period_end).getTime()
  const endedAt = toTime(subscription.ended_at)
  const endsAt = toTime(subscription.ends_at)
  const pausedAt =
    subscription.status === 'paused' && endedAt === null
      ? (toTime(subscription.paused_at) ?? periodEnd)
      : null

  const trialEnd =
    toTime(subscription.trial_end) ??
    (subscription.status === 'trialing' ? periodEnd : null)
  const billingStart =
    trialEnd === null
      ? start
      : Math.max(start, Math.min(trialEnd, endedAt ?? trialEnd))

  const renews =
    RENEWING_STATUSES.has(subscription.status) &&
    !subscription.pause_at_period_end &&
    endedAt === null &&
    endsAt === null
  const cyclesEnd =
    endedAt ??
    pausedAt ??
    endsAt ??
    (renews ? Math.max(horizon, periodEnd) : periodEnd)

  const segments: TimelineSegment[] = []
  if (billingStart > start) {
    segments.push({ kind: 'trial', start, end: billingStart })
  }

  const edges = getCycleEdges(subscription, billingStart, cyclesEnd)
  const cycles = edges.slice(1).map<TimelineSegment>((end, index) => {
    const cycleStart = edges[index]
    const kind =
      end <= now ? 'past' : cycleStart <= now ? 'current' : 'upcoming'
    return { kind, start: cycleStart, end }
  })
  segments.push(
    ...(periodEnd - periodStart < minCycleDuration
      ? mergeSameKind(cycles)
      : cycles),
  )

  let marker: SubscriptionTimeline['marker'] = null
  if (endedAt !== null) {
    marker = { kind: 'ended', at: endedAt }
  } else if (pausedAt !== null) {
    const resumesAt = toTime(subscription.resumes_at)
    const pausedUntil = Math.max(resumesAt ?? now, pausedAt)
    segments.push({ kind: 'paused', start: pausedAt, end: pausedUntil })
    marker = { kind: resumesAt ? 'resuming' : 'paused', at: pausedUntil }
  } else if (endsAt !== null) {
    marker = { kind: 'ending', at: endsAt }
  } else if (subscription.pause_at_period_end) {
    marker = { kind: 'pausing', at: periodEnd }
  }

  return { start, segments, marker }
}

export interface TimelineRange {
  start: number
  end: number
}

export const getTimelineStart = (
  subscriptions: TimelineSubscription[],
  floor: number,
): number => {
  const earliest = subscriptions.reduce(
    (earliest, subscription) =>
      Math.min(
        earliest,
        new Date(subscription.started_at).getTime(),
        toTime(subscription.trial_start) ?? earliest,
      ),
    floor,
  )
  return subMonths(startOfMonth(earliest), 1).getTime()
}
