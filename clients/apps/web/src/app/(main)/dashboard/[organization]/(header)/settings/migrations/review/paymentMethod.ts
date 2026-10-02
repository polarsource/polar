import { getPaymentMethodTypeLabel } from '@/components/PaymentMethodDisplay'
import { ReviewRow } from './reviewRows'

type PaymentMethodType = NonNullable<ReviewRow['payment_method_type']>

// Whether the copy from Stripe carries SEPA and ACH mandates over. Unconfirmed:
// `true` mirrors the pre-check's current note, `false` treats bank debits like
// Link and the other methods that stay behind.
export const BANK_DEBITS_COPIED = true

const BANK_DEBITS = new Set<PaymentMethodType>([
  'sepa_debit',
  'us_bank_account',
])

const NO_CARD_CONSEQUENCE =
  'The subscription still moves, but its first renewal on Polar fails and goes to dunning until the customer adds a card. Ask them to add one before it renews.'

const PAYMENT_METHOD_COPY = {
  noCardTitle: 'Moves without a payment method',
  bankDebitTitle: 'Bank debit, not checked yet',
  bankDebit:
    'Bank debits are copied without a check, so the first renewal on Polar is the first real charge. If it fails, the subscription goes to dunning.',
  notCopied: (label: string) =>
    `${label} can't be copied to Polar. ${NO_CARD_CONSEQUENCE}`,
  none: `This customer has no saved payment method on Stripe. ${NO_CARD_CONSEQUENCE}`,
}

type PaymentMethodKind = 'card' | 'bank_debit' | 'no_card'

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
  if (row.entity !== 'subscriptions' || row.status === 'skipped') return null
  const type = row.payment_method_type
  // An API that predates the field omits it; that isn't "no payment method".
  if (type === undefined) return null
  if (type === 'card') {
    return { label: getPaymentMethodTypeLabel(type), kind: 'card', note: null }
  }
  if (type && BANK_DEBITS.has(type) && BANK_DEBITS_COPIED) {
    return {
      label: getPaymentMethodTypeLabel(type),
      kind: 'bank_debit',
      note: {
        title: PAYMENT_METHOD_COPY.bankDebitTitle,
        body: PAYMENT_METHOD_COPY.bankDebit,
      },
    }
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
