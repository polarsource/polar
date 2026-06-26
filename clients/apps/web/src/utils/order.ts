import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrderById = async (
  api: Client,
  id: string,
): Promise<schemas['Order']> => {
  return unwrap(
    api.GET('/v1/orders/{id}', {
      params: {
        path: {
          id,
        },
      },
      cache: 'no-store',
    }),
    {
      404: notFound,
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getOrderById = cache(_getOrderById)

/**
 * Determines if an order is eligible for payment retry
 */
export const canRetryOrderPayment = (
  order: schemas['CustomerOrder'],
): boolean => {
  return (
    order.status === 'pending' &&
    order.next_payment_attempt_at !== null &&
    order.subscription !== null
  )
}

export function isOrderInDunningLifecycle(
  order: schemas['Order'],
  payments: schemas['Payment'][],
): boolean {
  return (
    !order.paid &&
    order.subscription_id !== null &&
    payments.some((payment) => payment.status === 'failed')
  )
}

export function isOrderInDunning(
  order: schemas['Order'],
  payments: schemas['Payment'][],
): boolean {
  return (
    isOrderInDunningLifecycle(order, payments) &&
    order.next_payment_attempt_at !== null
  )
}

export function isOrderDunningFailed(
  order: schemas['Order'],
  subscription: schemas['Subscription'],
  payments: schemas['Payment'][],
): boolean {
  return (
    isOrderInDunningLifecycle(order, payments) &&
    order.next_payment_attempt_at === null &&
    subscription.ended_at !== null &&
    subscription.customer_cancellation_reason === null
  )
}

/**
 * Returns the succeeded refund that was issued to prevent a chargeback, if the
 * order was (partially) refunded for that reason. This is the signal we use to
 * surface the chargeback prevention banner and derived status.
 */
export function getChargebackPreventionRefund(
  order: schemas['Order'],
  refunds: schemas['Refund'][],
): schemas['Refund'] | null {
  if (order.status !== 'refunded' && order.status !== 'partially_refunded') {
    return null
  }
  return (
    refunds.find(
      (refund) =>
        refund.reason === 'dispute_prevention' && refund.status === 'succeeded',
    ) ?? null
  )
}
