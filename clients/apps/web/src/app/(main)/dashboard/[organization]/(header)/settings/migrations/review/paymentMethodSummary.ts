import { schemas } from '@polar-sh/client'
import { joinList, plural } from './importSummary'

export type PaymentMethodCount = schemas['MerchantMigrationPaymentMethodCount']

type Assessment = PaymentMethodCount['assessment']

const NEEDS_NEW_METHOD: Partial<Record<Assessment, (count: number) => string>> =
  {
    paypal: (count) => `${count} on PayPal`,
    not_copyable: (count) => `${count} on a method that can't be copied`,
    india_card: (count) => `${count} on a likely India-issued card`,
    missing: (count) => `${count} with no payment method`,
  }

export function paymentMethodSummaryText(
  counts: PaymentMethodCount[],
): string | null {
  const parts = counts.flatMap(({ assessment, count }) => {
    const describe = NEEDS_NEW_METHOD[assessment]
    return describe ? [describe(count)] : []
  })
  if (parts.length === 0) return null
  const affected = counts.reduce(
    (sum, { assessment, count }) =>
      NEEDS_NEW_METHOD[assessment] ? sum + count : sum,
    0,
  )
  return `${plural(affected, 'subscription')} will need a new payment method on Polar: ${joinList(parts)}. They still move, but their first renewal fails and goes to dunning until the customer adds a card.`
}
