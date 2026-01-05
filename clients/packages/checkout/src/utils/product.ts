import type { CheckoutTranslations } from '@polar-sh/i18n'
import type { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit'
import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval'

const createOrdinalFormatter = (locale: string) => {
  const ordinalRules = new Intl.PluralRules(locale, { type: 'ordinal' })

  if (locale === 'nl') {
    return (number: number): string => `${number}e`
  }

  const suffixes = {
    zero: '',
    one: 'st',
    two: 'nd',
    few: 'rd',
    many: '',
    other: 'th',
  } as const

  return (number: number): string => {
    const category = ordinalRules.select(number)
    const suffix = suffixes[category]
    return number + suffix
  }
}

const defaultIntervalTranslations: CheckoutTranslations['pricing']['interval'] =
  {
    day: 'dy',
    week: 'wk',
    month: 'mo',
    year: 'yr',
  }

const defaultFrequencyTranslations: CheckoutTranslations['pricing']['frequency'] =
  {
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
    yearly: 'yearly',
    every: 'every {ordinal} {interval}',
  }

/**
 * Format a recurring interval with optional count for display in amounts/periods
 * @param interval - The recurring interval (day, week, month, year)
 * @param intervalCount - The number of intervals (e.g., 2 for "2nd month")
 * @param format - Display format: 'short' (mo, yr) or 'long' (month, year)
 * @param translations - Optional translations for interval labels
 * @param locale - Optional locale for ordinal formatting (default: 'en')
 * @returns Formatted string like "month", "2nd month", "mo", "3rd wk"
 */
export const formatRecurringInterval = (
  interval: SubscriptionRecurringInterval | null | undefined,
  intervalCount?: number | null,
  format: 'short' | 'long' = 'long',
  translations?: CheckoutTranslations['pricing']['interval'],
  locale: string = 'en',
): string => {
  if (!interval) {
    return ''
  }

  const ordinal = createOrdinalFormatter(locale)
  const count = intervalCount && intervalCount > 1 ? intervalCount : null
  const prefix = count ? `${ordinal(count)} ` : ''
  const t = translations ?? defaultIntervalTranslations

  if (format === 'short') {
    switch (interval) {
      case 'day':
        return `${prefix}${t.day}`
      case 'week':
        return `${prefix}${t.week}`
      case 'month':
        return `${prefix}${t.month}`
      case 'year':
        return `${prefix}${t.year}`
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
 * @param translations - Optional translations for frequency labels
 * @param locale - Optional locale for ordinal formatting (default: 'en')
 * @returns Formatted string like "monthly", "every 2nd month", "yearly", "every 3rd week"
 */
export const formatRecurringFrequency = (
  interval: SubscriptionRecurringInterval | null | undefined,
  intervalCount?: number | null,
  translations?: CheckoutTranslations['pricing']['frequency'],
  locale: string = 'en',
): string => {
  if (!interval) {
    return ''
  }

  const ordinal = createOrdinalFormatter(locale)
  const count = intervalCount && intervalCount > 1 ? intervalCount : null
  const t = translations ?? defaultFrequencyTranslations

  if (count) {
    return t.every
      .replace('{ordinal}', ordinal(count))
      .replace('{interval}', interval)
  }

  switch (interval) {
    case 'day':
      return t.daily
    case 'week':
      return t.weekly
    case 'month':
      return t.monthly
    case 'year':
      return t.yearly
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
