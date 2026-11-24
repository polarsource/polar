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
  | 'recovered'
  | 'canceled'
  | 'paused'
  | 'ended'
  | 'scheduled'

export interface SubscriptionActivityItem {
  kind: SubscriptionActivityKind
  label: string
  detail?: string
  at: number
  upcoming: boolean
  // The order behind the event, and whether it is about the order's payments.
  orderId?: string
  isPayment?: boolean
}

export interface SubscriptionDunning {
  // The order the attempts were made on.
  orderId?: string
  attempts: { at: number; isRetry: boolean; reason: string | null }[]
  nextAttemptAt: number | null
  recoveredAt: number | null
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

export type ActivityOrder = Pick<schemas['Order'], 'id' | 'created_at'>

// An order is made when the charge is due, a moment after the event it bills.
const ORDER_MATCH_WINDOW = 24 * 60 * 60 * 1000

// The charges that start, convert and renew a subscription each have an order.
const BILLED_KINDS = new Set<SubscriptionActivityKind>([
  'started',
  'converted',
  'renewal',
])

// The order made for an event at the given time, if there is one.
const findOrderAt = <T extends ActivityOrder>(
  orders: T[],
  at: number,
): T | undefined => {
  let closest: { order: T; distance: number } | undefined
  for (const order of orders) {
    const distance = Math.abs(new Date(order.created_at).getTime() - at)
    if (
      distance <= ORDER_MATCH_WINDOW &&
      distance < (closest?.distance ?? Infinity)
    ) {
      closest = { order, distance }
    }
  }
  return closest?.order
}

export const getSubscriptionActivity = (
  subscription: ActivitySubscription,
  now: number,
  dunning?: SubscriptionDunning,
  orders: ActivityOrder[] = [],
): SubscriptionActivityItem[] => {
  const items: SubscriptionActivityItem[] = []
  const add = (
    kind: SubscriptionActivityKind,
    label: string,
    at: number | null,
  ) => {
    if (at !== null) {
      const upcoming = at > now
      const orderId =
        !upcoming && BILLED_KINDS.has(kind)
          ? findOrderAt(orders, at)?.id
          : undefined
      items.push({ kind, label, at, upcoming, ...(orderId ? { orderId } : {}) })
    }
  }
  const payment = dunning?.orderId
    ? { orderId: dunning.orderId, isPayment: true }
    : {}

  const startedAt = new Date(subscription.started_at).getTime()
  const trialStart = toTime(subscription.trial_start)
  const trialEnd = toTime(subscription.trial_end)
  const endedAt = toTime(subscription.ended_at)
  const endsAt = toTime(subscription.ends_at)
  const periodStart = new Date(subscription.current_period_start).getTime()
  const periodEnd = new Date(subscription.current_period_end).getTime()
  // A trial that ran out without a payment method did not convert.
  const hasLapsed = subscription.status === 'trial_ended'
  const hasConverted =
    trialEnd !== null && !hasLapsed && (endedAt === null || endedAt > trialEnd)

  if (trialStart !== null) {
    add('trial', 'Trial started', trialStart)
    if (hasConverted) {
      if (trialEnd > now) {
        add('scheduled', 'Trial ends', trialEnd)
      } else {
        add('converted', 'Trial converted', trialEnd)
      }
    } else if (hasLapsed) {
      add('trial', 'Trial ended', trialEnd)
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
  // The attempts say more than the past due date, which is the first of them.
  if (dunning && dunning.attempts.length > 0) {
    for (const { at, isRetry, reason } of dunning.attempts) {
      items.push({
        kind: 'failed',
        label: isRetry ? 'Retry failed' : 'Payment failed',
        detail: reason ?? undefined,
        at,
        upcoming: false,
        ...payment,
      })
    }
  } else {
    add('failed', 'Payment failed', toTime(subscription.past_due_at))
  }
  if (dunning?.recoveredAt) {
    items.push({
      kind: 'recovered',
      label: 'Payment recovered',
      at: dunning.recoveredAt,
      upcoming: false,
      ...payment,
    })
  }
  if (dunning?.nextAttemptAt) {
    items.push({
      kind: 'scheduled',
      label: 'Payment retry',
      at: dunning.nextAttemptAt,
      upcoming: true,
      ...payment,
    })
  }
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
