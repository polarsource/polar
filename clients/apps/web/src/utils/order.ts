import { Client, schemas, unwrap } from '@polar-sh/client'
import { parseISO } from 'date-fns'
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
    (order.status === 'pending' || order.status === 'void') &&
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

// Mirror of UNRECOVERABLE_DECLINE_CODES in server/polar/models/payment.py.
// Keep in sync — Stripe decline codes that will never succeed on retry.
const UNRECOVERABLE_DECLINE_CODES = new Set([
  'card_not_supported',
  'do_not_honor',
  'expired_card',
  'fraudulent',
  'incorrect_cvc',
  'incorrect_number',
  'invalid_account',
  'invalid_cvc',
  'invalid_expiry_year',
  'invalid_pin',
  'live_mode_test_card',
  'lost_card',
  'merchant_blacklist',
  'not_permitted',
  'pickup_card',
  'previously_declined_do_not_retry',
  'restricted_card',
  'revocation_of_all_authorizations',
  'revocation_of_authorization',
  'security_violation',
  'stolen_card',
  'stop_payment_order',
  'blocklist',
])

export const isPaymentNonRecoverable = (payment: schemas['Payment']): boolean =>
  payment.decline_reason !== null &&
  UNRECOVERABLE_DECLINE_CODES.has(payment.decline_reason)

export function getLatestFailedPayment(
  payments: schemas['Payment'][],
): schemas['Payment'] | null {
  return (
    payments
      .filter((payment) => payment.status === 'failed')
      .toSorted(
        (a, b) =>
          parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
      )[0] ?? null
  )
}

export function isOrderNonRecoverable(
  order: schemas['Order'],
  subscription: schemas['Subscription'],
  payments: schemas['Payment'][],
): boolean {
  if (isOrderDunningFailed(order, subscription, payments)) {
    return false
  }

  const latestFailedPayment = getLatestFailedPayment(payments)

  return (
    latestFailedPayment !== null && isPaymentNonRecoverable(latestFailedPayment)
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
