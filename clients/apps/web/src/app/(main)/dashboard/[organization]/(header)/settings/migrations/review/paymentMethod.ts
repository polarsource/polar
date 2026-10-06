import { getPaymentMethodTypeLabel } from '@/components/PaymentMethodDisplay'
import { ReviewRow } from './reviewRows'

const NO_CARD_CONSEQUENCE =
  'The subscription still moves, but its first renewal on Polar fails and goes to dunning until the customer adds a card. Ask them to add one before it renews.'

const PAYMENT_METHOD_COPY = {
  noCardTitle: 'Moves without a payment method',
  notCopied: (label: string) =>
    `${label} can't be copied to Polar. ${NO_CARD_CONSEQUENCE}`,
  none: `This customer has no saved payment method on Stripe. ${NO_CARD_CONSEQUENCE}`,
}

// The pre-check's own payment notes. The side panel shows the payment method
// notice instead, so a row doesn't explain the same thing twice.
const PAYMENT_REASON_CODES = new Set([
  'payment_method_missing',
  'payment_method_requires_reentry',
])

export function isPaymentMethodReason(code: string | null): boolean {
  return code !== null && PAYMENT_REASON_CODES.has(code)
}

type PaymentMethodKind = 'card' | 'no_card'

export interface PaymentMethodNote {
  title: string
  body: string
}

export interface RowPaymentMethod {
  label: string
  kind: PaymentMethodKind
  note: PaymentMethodNote | null
}

// Only for rows that will move: a skipped subscription keeps its method on
// Stripe, so there is nothing to say about it.
export function rowPaymentMethod(row: ReviewRow): RowPaymentMethod | null {
  if (
    row.entity !== 'subscriptions' ||
    row.status === 'skipped' ||
    row.import_status === 'skipped'
  ) {
    return null
  }
  const type = row.payment_method_type
  // An API that predates the field omits it; that isn't "no payment method".
  if (type === undefined) return null
  if (type === 'card') {
    return { label: getPaymentMethodTypeLabel(type), kind: 'card', note: null }
  }
  const label =
    type === null
      ? 'No method'
      : type === 'other'
        ? 'Other method'
        : getPaymentMethodTypeLabel(type)
  return {
    label,
    kind: 'no_card',
    note: {
      title: PAYMENT_METHOD_COPY.noCardTitle,
      body: type
        ? PAYMENT_METHOD_COPY.notCopied(label)
        : PAYMENT_METHOD_COPY.none,
    },
  }
}
