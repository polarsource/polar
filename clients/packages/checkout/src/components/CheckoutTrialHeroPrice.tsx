'use client'

import { formatCurrency } from '@polar-sh/currency'
import type { AcceptedLocale } from '@polar-sh/i18n'
import {
  DEFAULT_LOCALE,
  getTranslations,
  useTranslations,
} from '@polar-sh/i18n'
import { formatDate } from '@polar-sh/i18n/formatters/date'
import { formatOrdinal } from '@polar-sh/i18n/formatters/ordinal'
import type { ProductCheckoutPublic } from '../guards'
import { isLegacyRecurringPrice } from '../utils/product'

export interface CheckoutTrialHeroPriceProps {
  checkout: ProductCheckoutPublic
  locale?: AcceptedLocale
}

const TRIAL_FREE_KEYS = {
  day: 'checkout.trial.hero.free.day',
  month: 'checkout.trial.hero.free.month',
  year: 'checkout.trial.hero.free.year',
} as const

const INTERVAL_SUFFIX_KEYS = {
  day: 'checkout.trial.hero.intervalSuffix.day',
  week: 'checkout.trial.hero.intervalSuffix.week',
  month: 'checkout.trial.hero.intervalSuffix.month',
  year: 'checkout.trial.hero.intervalSuffix.year',
} as const

const CheckoutTrialHeroPrice = ({
  checkout,
  locale,
}: CheckoutTrialHeroPriceProps) => {
  const { product, product_price } = checkout
  const effectiveLocale = locale ?? DEFAULT_LOCALE
  const t = useTranslations(effectiveLocale)

  const interval = isLegacyRecurringPrice(product_price)
    ? product_price.recurring_interval
    : product.recurring_interval

  const trialUnit =
    checkout.active_trial_interval === 'week'
      ? 'day'
      : (checkout.active_trial_interval as 'day' | 'month' | 'year')
  const trialCount =
    checkout.active_trial_interval === 'week'
      ? checkout.active_trial_interval_count! * 7
      : checkout.active_trial_interval_count!
  const trialLabel = t(TRIAL_FREE_KEYS[trialUnit], { count: trialCount })

  const currency = checkout.currency ?? product_price.price_currency
  const recurringAmount = checkout.total_amount ?? checkout.net_amount ?? 0
  const intervalCount = product.recurring_interval_count
  const intervalSuffix = (() => {
    if (!interval || !(interval in INTERVAL_SUFFIX_KEYS)) return ''
    if (intervalCount && intervalCount > 1) {
      const shortInterval =
        getTranslations(effectiveLocale).intervals.short[interval]
      return ` / ${formatOrdinal(intervalCount, effectiveLocale)} ${shortInterval}`
    }
    return t(
      INTERVAL_SUFFIX_KEYS[interval as keyof typeof INTERVAL_SUFFIX_KEYS],
    )
  })()
  const format = formatCurrency('standard', effectiveLocale)
  const priceStr = `${format(recurringAmount, currency)}${intervalSuffix}`

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
        {t('checkout.trial.hero.then')}{' '}
        <strong className="font-semibold">{priceStr}</strong>
        {dateStr
          ? ` ${t('checkout.trial.hero.startingDate', { date: dateStr })}`
          : ''}
      </span>
    </div>
  )
}

export default CheckoutTrialHeroPrice
