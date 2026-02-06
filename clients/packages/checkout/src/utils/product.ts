import {
  getTranslations,
  type SupportedLocale,
} from '@polar-sh/i18n'
import type { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit'
import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval'

const enSuffixes: Record<string, string> = {
  zero: '',
  one: 'st',
  two: 'nd',
  few: 'rd',
  many: '',
  other: 'th',
}

const ordinal = (number: number, locale: SupportedLocale = 'en'): string => {
  const rules = new Intl.PluralRules(locale, { type: 'ordinal' })
  const category = rules.select(number)

  if (locale === 'nl') {
    return `${number}e`
  }

  const suffix = enSuffixes[category] ?? ''
  return `${number}${suffix}`
}

/**
 * Format a recurring interval with optional count for display in amounts/periods
 * @param interval - The recurring interval (day, week, month, year)
 * @param intervalCount - The number of intervals (e.g., 2 for "2nd month")
 * @param format - Display format: 'short' (mo, yr) or 'long' (month, year)
 * @param locale - The locale to use for translations
 * @returns Formatted string like "month", "2nd month", "mo", "3rd wk"
 */
export const formatRecurringInterval = (
  interval: SubscriptionRecurringInterval | null | undefined,
  intervalCount?: number | null,
  format: 'short' | 'long' = 'long',
  locale: SupportedLocale = 'en',
): string => {
  if (!interval) {
    return ''
  }

  const t = getTranslations(locale)
  const count = intervalCount && intervalCount > 1 ? intervalCount : null
  const prefix = count ? `${ordinal(count, locale)} ` : ''
  const label = format === 'short'
    ? t.intervals.short[interval]
    : t.intervals.long[interval]

  return `${prefix}${label}`
}

/**
 * Format a recurring frequency for display in billing descriptions
 * @param interval - The recurring interval (day, week, month, year)
 * @param intervalCount - The number of intervals (e.g., 2 for "every 2nd month")
 * @param locale - The locale to use for translations
 * @returns Formatted string like "monthly", "every 2nd month", "yearly", "every 3rd week"
 */
export const formatRecurringFrequency = (
  interval: SubscriptionRecurringInterval | null | undefined,
  intervalCount?: number | null,
  locale: SupportedLocale = 'en',
): string => {
  if (!interval) {
    return ''
  }

  const t = getTranslations(locale)
  const count = intervalCount && intervalCount > 1 ? intervalCount : null

  if (count) {
    return t.intervals.frequency.everyOrdinalInterval
      .replace('{ordinal}', ordinal(count, locale))
      .replace('{interval}', t.intervals.long[interval])
  }

  return t.intervals.frequency[interval]
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
