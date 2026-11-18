import { schemas } from '@polar-sh/client'

const MONTHS_PER_INTERVAL: Record<schemas['RecurringInterval'], number> = {
  day: 12 / 365,
  week: 12 / 52,
  month: 1,
  year: 12,
}

const RECURRING_STATUSES = new Set<schemas['SubscriptionStatus']>([
  'active',
  'trialing',
  'past_due',
])

export const getMonthlyRecurringAmount = (
  subscription: Pick<
    schemas['Subscription'],
    | 'status'
    | 'amount'
    | 'recurring_interval'
    | 'recurring_interval_count'
    | 'ended_at'
  >,
): number | null => {
  if (subscription.ended_at || !RECURRING_STATUSES.has(subscription.status)) {
    return null
  }
  const months =
    MONTHS_PER_INTERVAL[subscription.recurring_interval] *
    Math.max(1, subscription.recurring_interval_count)
  return Math.round(subscription.amount / months)
}

export type SubscriptionActivityKind =
  | 'started'
  | 'trial'
  | 'converted'
  | 'renewal'
  | 'failed'
  | 'canceled'
  | 'paused'
  | 'ended'
  | 'scheduled'

export interface SubscriptionActivityItem {
  kind: SubscriptionActivityKind
  label: string
  at: number
  upcoming: boolean
}

export type ActivitySubscription = Pick<
  schemas['Subscription'],
  | 'status'
  | 'started_at'
  | 'current_period_start'
  | 'current_period_end'
  | 'trial_start'
  | 'trial_end'
  | 'canceled_at'
  | 'ends_at'
  | 'ended_at'
  | 'past_due_at'
  | 'paused_at'
  | 'resumes_at'
  | 'pause_at_period_end'
>

const toTime = (value: string | null | undefined): number | null =>
  value ? new Date(value).getTime() : null

export const getSubscriptionActivity = (
  subscription: ActivitySubscription,
  now: number,
): SubscriptionActivityItem[] => {
  const items: SubscriptionActivityItem[] = []
  const add = (
    kind: SubscriptionActivityKind,
    label: string,
    at: number | null,
  ) => {
    if (at !== null) {
      items.push({ kind, label, at, upcoming: at > now })
    }
  }

  const startedAt = new Date(subscription.started_at).getTime()
  const trialStart = toTime(subscription.trial_start)
  const trialEnd = toTime(subscription.trial_end)
  const endedAt = toTime(subscription.ended_at)
  const endsAt = toTime(subscription.ends_at)
  const periodStart = new Date(subscription.current_period_start).getTime()
  const periodEnd = new Date(subscription.current_period_end).getTime()
  const hasConverted =
    trialEnd !== null && (endedAt === null || endedAt > trialEnd)

  if (trialStart !== null) {
    add('trial', 'Trial started', trialStart)
    if (hasConverted) {
      if (trialEnd > now) {
        add('scheduled', 'Trial ends', trialEnd)
      } else {
        add('converted', 'Trial converted', trialEnd)
      }
    }
  } else {
    add('started', 'Subscribed', startedAt)
  }

  const billingStart = trialEnd ?? startedAt
  if (
    periodStart > billingStart &&
    periodStart <= now &&
    subscription.status !== 'paused' &&
    endedAt === null
  ) {
    add('renewal', 'Renewed', periodStart)
  }
  add('failed', 'Payment failed', toTime(subscription.past_due_at))
  add('canceled', 'Cancellation requested', toTime(subscription.canceled_at))
  add('paused', 'Paused', toTime(subscription.paused_at))
  add('ended', 'Ended', endedAt)

  if (endedAt === null) {
    if (endsAt !== null) {
      add('scheduled', 'Ends', endsAt)
    } else if (subscription.status === 'paused') {
      add('scheduled', 'Resumes', toTime(subscription.resumes_at))
    } else if (subscription.pause_at_period_end) {
      add('scheduled', 'Pauses', periodEnd)
      add('scheduled', 'Resumes', toTime(subscription.resumes_at))
    } else if (
      RECURRING_STATUSES.has(subscription.status) &&
      !(trialEnd !== null && trialEnd > now)
    ) {
      add('renewal', 'Renews', periodEnd)
    }
  }

  return items.sort((a, b) => b.at - a.at)
}
