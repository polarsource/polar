import type { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit'
import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval'

const ordinalRules = new Intl.PluralRules('en', { type: 'ordinal' })

const suffixes = {
  zero: '',
  one: 'st',
  two: 'nd',
  few: 'rd',
  many: '',
  other: 'th',
} as const

const ordinal = (number: number): string => {
  const category = ordinalRules.select(number)
  const suffix = suffixes[category]
  return number + suffix
}

/**
 * Format a recurring interval with optional count for display in amounts/periods
 * @param interval - The recurring interval (day, week, month, year)
 * @param intervalCount - The number of intervals (e.g., 2 for "2nd month")
 * @param format - Display format: 'short' (mo, yr) or 'long' (month, year)
 * @returns Formatted string like "month", "2nd month", "mo", "3rd wk"
 */
export const formatRecurringInterval = (
  interval: SubscriptionRecurringInterval | null | undefined,
  intervalCount?: number | null,
  format: 'short' | 'long' = 'long',
): string => {
  if (!interval) {
    return ''
  }

  const count = intervalCount && intervalCount > 1 ? intervalCount : null
  const prefix = count ? `${ordinal(count)} ` : ''

  if (format === 'short') {
    switch (interval) {
      case 'day':
        return `${prefix}dy`
      case 'week':
        return `${prefix}wk`
      case 'month':
        return `${prefix}mo`
      case 'year':
        return `${prefix}yr`
      default:
        return ''
    }
  }

  return `${prefix}${interval}`
}

/**
 * Format a recurring frequency for display in billing descriptions
 * @param interval - The recurring interval (day, week, month, year)
 * @param intervalCount - The number of intervals (e.g., 2 for "every 2nd month")
 * @returns Formatted string like "monthly", "every 2nd month", "yearly", "every 3rd week"
 */
export const formatRecurringFrequency = (
  interval: SubscriptionRecurringInterval | null | undefined,
  intervalCount?: number | null,
): string => {
  if (!interval) {
    return ''
  }

  const count = intervalCount && intervalCount > 1 ? intervalCount : null

  if (count) {
    return `every ${ordinal(count)} ${interval}`
  }

  switch (interval) {
    case 'day':
      return 'daily'
    case 'week':
      return 'weekly'
    case 'month':
      return 'monthly'
    case 'year':
      return 'yearly'
    default:
      return interval
  }
}

export const isLegacyRecurringPrice = (
  price: ProductPrice | LegacyRecurringProductPrice,
): price is LegacyRecurringProductPrice => 'legacy' in price

export const hasLegacyRecurringPrices = (
  prices: ProductPrice[],
): prices is LegacyRecurringProductPrice[] =>
  prices.some(isLegacyRecurringPrice)

export const isMeteredPrice = (
  price: ProductPrice | LegacyRecurringProductPrice,
): price is ProductPriceMeteredUnit => price.amountType === 'metered_unit'

export const getMeteredPrices = (
  prices: ProductPrice[],
): ProductPriceMeteredUnit[] => prices.filter(isMeteredPrice)
