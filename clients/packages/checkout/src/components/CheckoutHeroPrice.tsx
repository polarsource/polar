'use client'

import { formatCurrency } from '@polar-sh/currency'
import type { AcceptedLocale } from '@polar-sh/i18n'
import { DEFAULT_LOCALE } from '@polar-sh/i18n'
import { formatDate } from '@polar-sh/i18n/formatters/date'
import type { ProductCheckoutPublic } from '../guards'
import { isLegacyRecurringPrice } from '../utils/product'
import AmountLabel from './AmountLabel'

export interface CheckoutHeroPriceProps {
  checkout: ProductCheckoutPublic
  locale?: AcceptedLocale
}

const INTERVAL_UNITS: Record<string, { one: string; other: string }> = {
  day: { one: 'day', other: 'days' },
  week: { one: 'week', other: 'weeks' },
  month: { one: 'month', other: 'months' },
  year: { one: 'year', other: 'years' },
}

const CheckoutHeroPrice = ({ checkout, locale }: CheckoutHeroPriceProps) => {
  const { product, productPrice } = checkout
  const effectiveLocale = locale ?? DEFAULT_LOCALE

  const interval = isLegacyRecurringPrice(productPrice)
    ? productPrice.recurringInterval
    : product.recurringInterval

  const hasTrial =
    checkout.activeTrialInterval && checkout.activeTrialIntervalCount

  if (hasTrial) {
    // Normalize weeks to days for clarity (e.g. "1 week" → "7 days")
    const trialDays =
      checkout.activeTrialInterval === 'week'
        ? checkout.activeTrialIntervalCount! * 7
        : checkout.activeTrialIntervalCount!
    const trialUnit =
      checkout.activeTrialInterval === 'week'
        ? INTERVAL_UNITS.day
        : INTERVAL_UNITS[checkout.activeTrialInterval!]
    const trialLabel = `${trialDays} ${trialDays === 1 ? trialUnit.one : trialUnit.other} free`

    const currency = checkout.currency ?? productPrice.priceCurrency
    const recurringAmount = checkout.totalAmount ?? checkout.netAmount ?? 0
    const intervalName = interval
      ? `/${INTERVAL_UNITS[interval]?.one ?? interval}`
      : ''
    const format = formatCurrency('standard', effectiveLocale)
    const priceStr = `${format(recurringAmount, currency)}${intervalName}`

    const dateStr = checkout.trialEnd
      ? formatDate(checkout.trialEnd, effectiveLocale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null

    return (
      <div className="flex flex-col gap-y-1">
        <span>{trialLabel}</span>
        <span className="dark:text-polar-500 text-sm font-normal text-gray-500">
          Then <strong className="font-semibold">{priceStr}</strong>
          {dateStr ? ` starting ${dateStr}` : ''}
        </span>
      </div>
    )
  }

  return (
    <AmountLabel
      amount={checkout.totalAmount ?? checkout.netAmount ?? 0}
      currency={checkout.currency ?? productPrice.priceCurrency}
      interval={interval}
      intervalCount={product.recurringIntervalCount}
      mode="standard"
      locale={locale}
    />
  )
}

export default CheckoutHeroPrice
