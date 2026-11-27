import {
  getSubscriptionActivity,
  type SubscriptionActivityItem,
  type SubscriptionActivityKind,
} from '@/utils/subscriptionSummary'
import { DAY_MS } from '@/utils/subscriptionTimeline'
import { schemas } from '@polar-sh/client'

// Renewals are orders, or the upcoming charge, and never rows of their own.
const EVENT_KINDS = new Set<SubscriptionActivityKind>([
  'started',
  'trial',
  'converted',
  'canceled',
  'paused',
  'ended',
  'scheduled',
])

// What happened to the subscription that no order in its history already
// tells: an event with an order is that order's row, and one on the day of the
// upcoming charge is that charge's row.
export const getBillingHistoryEvents = (
  subscription: schemas['Subscription'],
  orders: schemas['Order'][],
  upcomingChargeDate: string | null | undefined,
  now: number,
): SubscriptionActivityItem[] => {
  const chargeAt = upcomingChargeDate
    ? new Date(upcomingChargeDate).getTime()
    : null
  return getSubscriptionActivity(subscription, now, undefined, orders).filter(
    ({ kind, orderId, upcoming, at }) =>
      EVENT_KINDS.has(kind) &&
      !orderId &&
      !(upcoming && chargeAt !== null && Math.abs(at - chargeAt) < DAY_MS),
  )
}
