'use client'

import { formatCurrency } from '@polar-sh/currency'
import type { AcceptedLocale } from '@polar-sh/i18n'
import { DEFAULT_LOCALE, useTranslations } from '@polar-sh/i18n'
import { formatDate } from '@polar-sh/i18n/formatters/date'
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
  const { product, productPrice } = checkout
  const effectiveLocale = locale ?? DEFAULT_LOCALE
  const t = useTranslations(effectiveLocale)

  const interval = isLegacyRecurringPrice(productPrice)
    ? productPrice.recurringInterval
    : product.recurringInterval

  const trialUnit =
    checkout.activeTrialInterval === 'week'
      ? 'day'
      : (checkout.activeTrialInterval as 'day' | 'month' | 'year')
  const trialCount =
    checkout.activeTrialInterval === 'week'
      ? checkout.activeTrialIntervalCount! * 7
      : checkout.activeTrialIntervalCount!
  const trialLabel = t(TRIAL_FREE_KEYS[trialUnit], { count: trialCount })

  const currency = checkout.currency ?? productPrice.priceCurrency
  const recurringAmount = checkout.totalAmount ?? checkout.netAmount ?? 0
  const intervalSuffix =
    interval && interval in INTERVAL_SUFFIX_KEYS
      ? t(INTERVAL_SUFFIX_KEYS[interval as keyof typeof INTERVAL_SUFFIX_KEYS])
      : ''
  const format = formatCurrency('standard', effectiveLocale)
  const priceStr = `${format(recurringAmount, currency)}${intervalSuffix}`

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
