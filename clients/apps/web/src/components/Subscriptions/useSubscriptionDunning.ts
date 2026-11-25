import { useOrders } from '@/hooks/queries/orders'
import { usePayments } from '@/hooks/queries/payments'
import { type SubscriptionDunning } from '@/utils/subscriptionSummary'

const ATTEMPT_LIMIT = 20

// The failed charges on the latest order of a subscription, with either the
// next automatic retry or the charge that finally went through.
export const useSubscriptionDunning = (
  organizationId: string,
  subscriptionId: string,
): SubscriptionDunning | undefined => {
  const { data: orders } = useOrders(organizationId, {
    subscription_id: subscriptionId,
    sorting: ['-created_at'],
    limit: 1,
  })
  const order = orders?.items[0]
  const { data: payments } = usePayments(
    organizationId,
    { order_id: order?.id, sorting: ['-created_at'], limit: ATTEMPT_LIMIT },
    order !== undefined,
  )

  if (!order) return undefined
  const attempts = (payments?.items ?? [])
    .filter(({ status }) => status === 'failed')
    .map((payment) => ({
      at: new Date(payment.created_at).getTime(),
      isRetry: payment.trigger?.startsWith('retry_') ?? false,
      reason: payment.decline_message,
    }))
  const succeeded = payments?.items.find(({ status }) => status === 'succeeded')
  return {
    orderId: order.id,
    attempts,
    nextAttemptAt:
      order.status === 'pending' && order.next_payment_attempt_at
        ? new Date(order.next_payment_attempt_at).getTime()
        : null,
    recoveredAt:
      succeeded && attempts.length > 0
        ? new Date(succeeded.created_at).getTime()
        : null,
  }
}
