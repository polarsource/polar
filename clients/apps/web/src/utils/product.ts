import { Product, SubscriptionRecurringInterval } from '@polar-sh/sdk'

export const hasIntervals = (product: Product): [boolean, boolean, boolean] => {
  const hasMonthInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' &&
      price.recurring_interval === SubscriptionRecurringInterval.MONTH,
  )
  const hasYearInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' &&
      price.recurring_interval === SubscriptionRecurringInterval.YEAR,
  )
  const hasBothIntervals = hasMonthInterval && hasYearInterval

  return [hasMonthInterval, hasYearInterval, hasBothIntervals]
}
