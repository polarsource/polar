import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'

export const hasRecurringIntervals = (
  product: CheckoutProduct,
): [boolean, boolean, boolean] => {
  const hasMonthInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' && price.recurringInterval === 'month',
  )
  const hasYearInterval = product.prices.some(
    (price) => price.type === 'recurring' && price.recurringInterval === 'year',
  )
  const hasBothIntervals = hasMonthInterval && hasYearInterval

  return [hasMonthInterval, hasYearInterval, hasBothIntervals]
}
