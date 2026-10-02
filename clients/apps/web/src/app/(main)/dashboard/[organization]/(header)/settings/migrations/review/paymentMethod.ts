import { ReviewRow } from './reviewRows'

type PaymentMethodType = NonNullable<ReviewRow['payment_method_type']>

const LABELS: Record<PaymentMethodType, string> = {
  card: 'Card',
  kr_card: 'Korean card',
  us_bank_account: 'ACH Debit',
  sepa_debit: 'SEPA Debit',
  bacs_debit: 'Bacs Debit',
  link: 'Link',
  other: 'Other',
}

export interface RowPaymentMethod {
  label: string
  moves: boolean
  // What the merchant reads when the method stays behind.
  explanation: string | null
}

// Only cards are copied to Polar. Everything else, and a subscription with no
// method at all, still moves but has nothing to charge at its first renewal.
export function rowPaymentMethod(row: ReviewRow): RowPaymentMethod | null {
  if (row.entity !== 'subscriptions' || row.status === 'skipped') return null
  const type = row.payment_method_type
  if (type === 'card') {
    return { label: LABELS.card, moves: true, explanation: null }
  }
  const label = type ? LABELS[type] : 'None'
  return {
    label,
    moves: false,
    explanation: `${type ? `${label} can't be copied to Polar, only cards can.` : 'This customer has no saved payment method on Stripe.'} ${PAYMENT_METHOD_STAYS_COPY.consequence}`,
  }
}

export const PAYMENT_METHOD_STAYS_COPY = {
  title: "Payment method won't move",
  consequence:
    'The subscription still moves, but its first renewal on Polar fails and goes to dunning until the customer adds a card. Ask them to add one before it renews.',
  summary: (count: number) =>
    `${count} ${count === 1 ? 'subscription moves' : 'subscriptions move'} without a payment method`,
  summaryDetail:
    'Only cards are copied from Stripe. Link, bank debits, PayPal and other methods stay behind, so these customers need to add a card before their first renewal on Polar, or it goes to dunning.',
}
