import { schemas } from '@polar-sh/client'
import {
  getMetadataString,
  isSubscriptionPaymentStatusEventName,
  type CustomerActivityTimelineEventWithPaymentStatusName,
  type SubscriptionPaymentStatus,
} from './event-config'

const NON_RECURRING_BILLING_TYPES = new Set(['purchase', 'one_time'])

export type SubscriptionPaymentResolution = {
  statusesByEventId: Record<string, SubscriptionPaymentStatus>
  linkedOrderPaidEventIds: Set<string>
}

export function buildSubscriptionPaymentResolution(
  allEvents: schemas['Event'][],
): SubscriptionPaymentResolution {
  const lifecycleBySubscription = groupBySubscriptionId(
    allEvents.filter(isLifecycleEvent),
  )
  const paymentsBySubscription = groupBySubscriptionId(
    allEvents.filter(isRecurringOrderPaidEvent),
  )

  const paidLifecycleEventIds = new Set<string>()
  const linkedOrderPaidEventIds = new Set<string>()
  const allUnmatchedPayments = new Set(
    allEvents.filter(isRecurringOrderPaidEvent),
  )

  for (const [subscriptionId, lifecycleEvents] of lifecycleBySubscription) {
    const subscriptionPayments = paymentsBySubscription.get(subscriptionId)
    const unmatchedSubscriptionPayments = subscriptionPayments
      ? new Set(sortByTimestamp(subscriptionPayments))
      : new Set<schemas['Event']>()

    for (const lifecycle of sortByTimestamp(lifecycleEvents)) {
      const match = findClosestUnmatched(
        lifecycle,
        unmatchedSubscriptionPayments,
        allUnmatchedPayments,
      )
      if (!match) continue

      paidLifecycleEventIds.add(lifecycle.id)
      linkedOrderPaidEventIds.add(match.id)
      unmatchedSubscriptionPayments.delete(match)
      allUnmatchedPayments.delete(match)
    }
  }

  const statusesByEventId: Record<string, SubscriptionPaymentStatus> = {}
  for (const event of allEvents) {
    if (!isLifecycleEvent(event)) continue
    statusesByEventId[event.id] = paidLifecycleEventIds.has(event.id)
      ? 'paid'
      : 'unpaid'
  }

  return { statusesByEventId, linkedOrderPaidEventIds }
}

export function buildSubscriptionPaymentStatusByEventId(
  allEvents: schemas['Event'][],
): Record<string, SubscriptionPaymentStatus> {
  return buildSubscriptionPaymentResolution(allEvents).statusesByEventId
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function findClosestUnmatched(
  lifecycle: schemas['Event'],
  candidates: Set<schemas['Event']>,
  allUnmatchedPayments: Set<schemas['Event']>,
): schemas['Event'] | null {
  const directChild = findDirectChildPayment(lifecycle, allUnmatchedPayments)
  if (directChild) return directChild

  const lifecycleTime = new Date(lifecycle.timestamp).getTime()
  let closest: schemas['Event'] | null = null
  let smallestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const distance = Math.abs(
      new Date(candidate.timestamp).getTime() - lifecycleTime,
    )
    if (distance < smallestDistance) {
      smallestDistance = distance
      closest = candidate
    }
  }

  return closest
}

function findDirectChildPayment(
  lifecycle: schemas['Event'],
  payments: Set<schemas['Event']>,
): schemas['Event'] | null {
  for (const payment of payments) {
    if (payment.parent_id === lifecycle.id) return payment
  }
  return null
}

function groupBySubscriptionId(
  events: schemas['Event'][],
): Map<string, schemas['Event'][]> {
  const map = new Map<string, schemas['Event'][]>()

  for (const event of events) {
    const subscriptionId = getMetadataString(event, 'subscription_id')
    if (!subscriptionId) continue

    const existing = map.get(subscriptionId)
    if (existing) {
      existing.push(event)
    } else {
      map.set(subscriptionId, [event])
    }
  }

  return map
}

function sortByTimestamp(events: schemas['Event'][]): schemas['Event'][] {
  return [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
}

function isLifecycleEvent(
  event: schemas['Event'],
): event is schemas['Event'] & {
  name: CustomerActivityTimelineEventWithPaymentStatusName
} {
  return isSubscriptionPaymentStatusEventName(event.name)
}

function isRecurringOrderPaidEvent(event: schemas['Event']): boolean {
  if (event.name !== 'order.paid') return false
  const billingType = (event.metadata as Record<string, unknown>).billing_type
  return (
    typeof billingType !== 'string' ||
    !NON_RECURRING_BILLING_TYPES.has(billingType)
  )
}
