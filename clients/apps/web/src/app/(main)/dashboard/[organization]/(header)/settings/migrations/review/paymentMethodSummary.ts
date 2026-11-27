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
  return `${plural(affected, 'subscription')} may need a new payment method on Polar: ${joinList(parts)}. They still move, but a renewal may fail and go to dunning unless another usable card is already on Polar or the customer adds one before renewal.`
}
