import { schemas } from '@polar-sh/client'
import type { StatusColor } from '@polar-sh/orbit'

type PaymentDisplayStatus = schemas['PaymentStatus'] | 'blocked'

// Stripe `outcome.reason` values set when Radar blocks a payment before it reaches the issuer.
// See: https://docs.stripe.com/api/charges/object#charge_object-outcome-reason
const BLOCKED_DECLINE_REASONS = new Set([
  'rule',
  'highest_risk_level',
  'elevated_risk_level',
])

export const PaymentStatusDisplayTitle: Record<PaymentDisplayStatus, string> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  failed: 'Declined',
  blocked: 'Blocked',
}

export const PaymentStatusDisplayColor: Record<
  PaymentDisplayStatus,
  StatusColor
> = {
  succeeded: 'green',
  pending: 'yellow',
  failed: 'red',
  blocked: 'red',
}

export const isBlockedPayment = (payment: schemas['Payment']): boolean =>
  payment.status === 'failed' &&
  payment.decline_reason !== null &&
  BLOCKED_DECLINE_REASONS.has(payment.decline_reason)

export const getPaymentDisplayStatus = (
  payment: schemas['Payment'],
): PaymentDisplayStatus =>
  isBlockedPayment(payment) ? 'blocked' : payment.status

// Radar rules are Polar's, not the merchant's, so Stripe's "One of your rules…" is misleading.
export const getPaymentDeclineMessage = (
  payment: schemas['Payment'],
): string | null => {
  if (payment.decline_reason === 'rule') {
    return 'Polar blocked this payment because of suspicious activity.'
  }
  return payment.decline_message || payment.decline_reason
}

export const isCardPayment = (
  payment: schemas['Payment'],
): payment is schemas['CardPayment'] => payment.method === 'card'

export const isKrCardPayment = (
  payment: schemas['Payment'],
): payment is schemas['KrCardPayment'] => payment.method === 'kr_card'
