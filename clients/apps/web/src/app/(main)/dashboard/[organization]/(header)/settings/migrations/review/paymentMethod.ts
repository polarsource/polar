import { getPaymentMethodTypeLabel } from '@/components/PaymentMethodDisplay'
import { ReviewRow } from './reviewRows'

type PaymentMethodType = NonNullable<ReviewRow['payment_method_type']>

// Unconfirmed whether the copy from Stripe carries SEPA and ACH mandates over.
// Either way the status reads "Needs a card"; `false` keeps the bank-debit note
// neutral, `true` says it can't be copied, like Link.
export const BANK_DEBITS_STAY_BEHIND = false

const BANK_DEBITS = new Set<PaymentMethodType>([
  'sepa_debit',
  'us_bank_account',
])

const NO_CARD_CONSEQUENCE =
  'The subscription still moves, but its first renewal on Polar fails and goes to dunning until the customer adds a card. Ask them to add one before it renews.'

const PAYMENT_METHOD_COPY = {
  noCardTitle: 'Moves without a payment method',
  bankDebitTitle: 'Bank debit, check before it renews',
  bankDebit:
    "The subscription still moves, but Polar hasn't confirmed this bank debit can be charged. If its first renewal on Polar fails, it goes to dunning until the customer adds a card.",
  notCopied: (label: string) =>
    `${label} can't be copied to Polar. ${NO_CARD_CONSEQUENCE}`,
  none: `This customer has no saved payment method on Stripe. ${NO_CARD_CONSEQUENCE}`,
}

// The pre-check's own payment notes. The side panel shows the payment method
// notice instead, so a row doesn't explain the same thing twice.
const PAYMENT_REASON_CODES = new Set([
  'payment_method_missing',
  'payment_method_requires_reentry',
  'payment_method_not_card',
])

export function isPaymentMethodReason(code: string | null): boolean {
  return code !== null && PAYMENT_REASON_CODES.has(code)
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
  if (type && BANK_DEBITS.has(type) && !BANK_DEBITS_STAY_BEHIND) {
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
