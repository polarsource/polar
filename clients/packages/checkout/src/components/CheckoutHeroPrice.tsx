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
  const { product, product_price } = checkout
  const effectiveLocale = locale ?? DEFAULT_LOCALE

  const interval = isLegacyRecurringPrice(product_price)
    ? product_price.recurring_interval
    : product.recurring_interval

  const hasTrial =
    checkout.active_trial_interval && checkout.active_trial_interval_count

  if (hasTrial) {
    // Normalize weeks to days for clarity (e.g. "1 week" → "7 days")
    const trialDays =
      checkout.active_trial_interval === 'week'
        ? checkout.active_trial_interval_count! * 7
        : checkout.active_trial_interval_count!
    const trialUnit =
      checkout.active_trial_interval === 'week'
        ? INTERVAL_UNITS.day
        : INTERVAL_UNITS[checkout.active_trial_interval!]
    const trialLabel = `${trialDays} ${trialDays === 1 ? trialUnit.one : trialUnit.other} free`

    const currency = checkout.currency ?? product_price.price_currency
    const recurringAmount = checkout.total_amount ?? checkout.net_amount ?? 0
    const intervalName = interval
      ? `/${INTERVAL_UNITS[interval]?.one ?? interval}`
      : ''
    const format = formatCurrency('standard', effectiveLocale)
    const priceStr = `${format(recurringAmount, currency)}${intervalName}`

    const dateStr = checkout.trial_end
      ? formatDate(checkout.trial_end, effectiveLocale, {
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
      amount={checkout.total_amount ?? checkout.net_amount ?? 0}
      currency={checkout.currency ?? product_price.price_currency}
      interval={interval}
      intervalCount={product.recurring_interval_count}
      mode="standard"
      locale={locale}
    />
  )
}

export default CheckoutHeroPrice
