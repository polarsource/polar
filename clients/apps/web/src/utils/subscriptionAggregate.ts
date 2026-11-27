import { schemas } from '@polar-sh/client'
import {
  addMonths,
  addWeeks,
  eachMonthOfInterval,
  eachWeekOfInterval,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { getMonthlyRecurringAmount } from './subscriptionSummary'
import {
  getSubscriptionTimeline,
  type TimelineRange,
} from './subscriptionTimeline'

export type AggregateUnit = 'week' | 'month'

const WEEK = { weekStartsOn: 1 } as const

const UNITS = {
  week: {
    floor: (time: number) => startOfWeek(time, WEEK).getTime(),
    next: (time: number) => addWeeks(time, 1).getTime(),
    each: (range: TimelineRange) => eachWeekOfInterval(range, WEEK),
  },
  month: {
    floor: (time: number) => startOfMonth(time).getTime(),
    next: (time: number) => addMonths(time, 1).getTime(),
    each: (range: TimelineRange) => eachMonthOfInterval(range),
  },
}

export interface AggregateBucket {
  start: number
  end: number
  renewals: number
  renewingAmount: number
  atRisk: number
  atRiskAmount: number
}

export interface AggregateGroup {
  key: string
  label: string
}

// A group holds one currency. With several in use, each gets a row of its
// own, since amounts in different currencies cannot be added up.
export interface AggregateRow extends AggregateGroup {
  id: string
  subscriptions: number
  monthlyAmount: number
  currency: string
  buckets: AggregateBucket[]
}

interface AggregateOptions {
  unit: AggregateUnit
  range: TimelineRange
  now: number
  groupOf: (subscription: schemas['Subscription']) => AggregateGroup
}

const BILLED_KINDS = new Set(['past', 'current', 'upcoming'])
const LOSS_MARKERS = new Set(['ended', 'ending', 'pausing'])

// Renewals are the charges after the first one. A charge that follows a trial
// counts, since it is expected revenue that has not been collected before.
export const aggregateSubscriptions = (
  subscriptions: schemas['Subscription'][],
  { unit, range, now, groupOf }: AggregateOptions,
): AggregateRow[] => {
  const { floor, next, each } = UNITS[unit]
  const starts = each(range).map((date) => date.getTime())
  const rows = new Map<
    string,
    { row: AggregateRow; byStart: Map<number, AggregateBucket> }
  >()

  for (const subscription of subscriptions) {
    const group = groupOf(subscription)
    const id = `${group.key}:${subscription.currency}`
    let entry = rows.get(id)
    if (!entry) {
      const buckets = starts.map<AggregateBucket>((start) => ({
        start,
        end: next(start),
        renewals: 0,
        renewingAmount: 0,
        atRisk: 0,
        atRiskAmount: 0,
      }))
      entry = {
        row: {
          ...group,
          id,
          subscriptions: 0,
          monthlyAmount: 0,
          currency: subscription.currency,
          buckets,
        },
        byStart: new Map(buckets.map((bucket) => [bucket.start, bucket])),
      }
      rows.set(id, entry)
    }
    const { row, byStart } = entry
    row.subscriptions += 1
    row.monthlyAmount += getMonthlyRecurringAmount(subscription) ?? 0

    const { segments, marker } = getSubscriptionTimeline(subscription, {
      now,
      horizon: range.end,
    })
    const isPastDue = subscription.status === 'past_due'
    const firstBilled = segments.findIndex(({ kind }) => BILLED_KINDS.has(kind))
    segments.forEach((segment, index) => {
      // A trial that ran out without a payment method is not charged.
      const isRenewal =
        subscription.status !== 'trial_ended' &&
        BILLED_KINDS.has(segment.kind) &&
        (index > firstBilled || segments[index - 1]?.kind === 'trial')
      const bucket = isRenewal ? byStart.get(floor(segment.start)) : undefined
      if (!bucket) return
      if (isPastDue && segment.start >= now) {
        bucket.atRisk += 1
        bucket.atRiskAmount += subscription.amount
      } else {
        bucket.renewals += 1
        bucket.renewingAmount += subscription.amount
      }
    })

    const loss =
      marker && LOSS_MARKERS.has(marker.kind)
        ? byStart.get(floor(marker.at))
        : undefined
    if (loss) {
      loss.atRisk += 1
      loss.atRiskAmount += subscription.amount
    }
  }

  const sorted = [...rows.values()]
    .map(({ row }) => row)
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
  const currencies = new Set(sorted.map(({ currency }) => currency))
  return currencies.size > 1
    ? sorted.map((row) => ({
        ...row,
        label: `${row.label} · ${row.currency.toUpperCase()}`,
      }))
    : sorted
}
