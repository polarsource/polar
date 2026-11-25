import { schemas } from '@polar-sh/client'
import {
  type SubscriptionActivityItem,
  type SubscriptionActivityKind,
} from './subscriptionSummary'

type ActivityOrder = Pick<
  schemas['Order'],
  'id' | 'created_at' | 'billing_reason' | 'status'
>

const ORDER_ACTIVITY: Record<
  schemas['OrderBillingReason'],
  { kind: SubscriptionActivityKind; label: string }
> = {
  purchase: { kind: 'started', label: 'Purchased' },
  subscription_create: { kind: 'started', label: 'Subscribed' },
  subscription_cycle: { kind: 'renewal', label: 'Renewed' },
  subscription_update: { kind: 'update', label: 'Plan changed' },
  subscription_meter_cycle: { kind: 'usage', label: 'Usage billed' },
}

// What became of an order after it was charged. A pending one is told by its
// payment attempts instead.
const ORDER_OUTCOMES: Partial<Record<schemas['OrderStatus'], string>> = {
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
  void: 'Voided',
}

// The subscription's events with every order among them: an order that an
// event already stands for is that event, and every other one is its own.
export const withOrderActivity = (
  activity: SubscriptionActivityItem[],
  orders: ActivityOrder[],
): SubscriptionActivityItem[] => {
  const byId = new Map(orders.map((order) => [order.id, order]))
  const told = new Set<string>()
  const events = activity.map((item) => {
    const order = item.orderId ? byId.get(item.orderId) : undefined
    if (!order || item.isPayment) return item
    told.add(order.id)
    const outcome = ORDER_OUTCOMES[order.status]
    return outcome && !item.detail ? { ...item, detail: outcome } : item
  })
  const untold = orders
    .filter((order) => !told.has(order.id))
    .map((order) => ({
      ...ORDER_ACTIVITY[order.billing_reason],
      detail: ORDER_OUTCOMES[order.status],
      at: new Date(order.created_at).getTime(),
      upcoming: false,
      orderId: order.id,
    }))
  return [...events, ...untold].sort((a, b) => b.at - a.at)
}
