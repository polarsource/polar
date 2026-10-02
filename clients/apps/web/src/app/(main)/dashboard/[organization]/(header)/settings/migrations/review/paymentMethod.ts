import { ReviewRow } from './reviewRows'

type PaymentMethodType = NonNullable<ReviewRow['payment_method_type']>

// Whether the copy from Stripe carries SEPA and ACH mandates over. Unconfirmed:
// `true` mirrors the pre-check's current note, `false` treats bank debits like
// Link and the other methods that stay behind.
export const BANK_DEBITS_COPIED = true

const LABELS: Record<PaymentMethodType, string> = {
  card: 'Card',
  kr_card: 'Korean card',
  us_bank_account: 'ACH Debit',
  sepa_debit: 'SEPA Debit',
  bacs_debit: 'Bacs Debit',
  link: 'Link',
  other: 'Other method',
}

const BANK_DEBITS = new Set<PaymentMethodType>([
  'sepa_debit',
  'us_bank_account',
])

const NO_CARD_CONSEQUENCE =
  'The subscription still moves, but its first renewal on Polar fails and goes to dunning until the customer adds a card. Ask them to add one before it renews.'

export const PAYMENT_METHOD_COPY = {
  noCardTitle: 'Moves without a payment method',
  bankDebitTitle: 'Bank debit, not checked yet',
  bankDebit:
    'Bank debits are copied without a check, so the first renewal on Polar is the first real charge. If it fails, the subscription goes to dunning.',
  notCopied: (label: string) =>
    `${label} can't be copied to Polar. ${NO_CARD_CONSEQUENCE}`,
  none: `This customer has no saved payment method on Stripe. ${NO_CARD_CONSEQUENCE}`,
}

export type PaymentMethodKind = 'card' | 'bank_debit' | 'no_card'

export interface RowPaymentMethod {
  type: PaymentMethodType | null
  label: string
  kind: PaymentMethodKind
  // Set when the merchant should know something; null for a plain card.
  note: { title: string; body: string } | null
}

// Only for rows that will move: a skipped subscription keeps its method on
// Stripe, so there is nothing to say about it.
export function rowPaymentMethod(row: ReviewRow): RowPaymentMethod | null {
  if (row.entity !== 'subscriptions' || row.status === 'skipped') return null
  const type = row.payment_method_type ?? null
  if (type === 'card') {
    return { type, label: LABELS.card, kind: 'card', note: null }
  }
  if (type && BANK_DEBITS.has(type) && BANK_DEBITS_COPIED) {
    return {
      type,
      label: LABELS[type],
      kind: 'bank_debit',
      note: {
        title: PAYMENT_METHOD_COPY.bankDebitTitle,
        body: PAYMENT_METHOD_COPY.bankDebit,
      },
    }
  }
  const label = type ? LABELS[type] : 'No method'
  return {
    type,
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
