'use client'

import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { formatDate } from '@polar-sh/i18n/formatters/date'
import { cn } from '@polar-sh/ui/lib/utils'
import { addMonths, addYears } from 'date-fns'
import { PropsWithChildren, useMemo } from 'react'
import { hasProductCheckout, isLegacyRecurringProductPrice } from '../guards'
import { getDiscountDisplay } from '../utils/discount'
import { getMeteredPrices } from '../utils/product'
import { unreachable } from '../utils/unreachable'
import AmountLabel from './AmountLabel'
import MeteredPriceLabel from './MeteredPriceLabel'

const DetailRow = ({
  title,
  subtitle,
  emphasis,
  className,
  children,
}: PropsWithChildren<{
  title: string
  subtitle?: string
  emphasis?: boolean
  className?: string
}>) => {
  return (
    <div
      data-testid={`detail-row-${title}`}
      className={cn(
        'flex flex-row items-start justify-between gap-x-8',
        emphasis ? 'font-medium' : 'dark:text-polar-500 text-gray-500',
        className,
      )}
    >
      <span className="min-w-0 truncate">
        {title}
        {subtitle && (
          <span className="dark:text-polar-600 ml-1 text-gray-400">
            {subtitle}
          </span>
        )}
      </span>
      <span className="shrink-0">{children}</span>
    </div>
  )
}

function formatShortDate(date: Date, locale: AcceptedLocale): string {
  const isCurrentYear = date.getFullYear() === new Date().getFullYear()
  return formatDate(date, locale, {
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  })
}

function getDiscountEndDate(
  baseDate: Date,
  discount: NonNullable<schemas['CheckoutPublic']['discount']>,
  interval: string | null,
  intervalCount: number | null,
): Date {
  if (discount.duration === 'once') {
    const count = intervalCount ?? 1
    return interval === 'year'
      ? addYears(baseDate, count)
      : addMonths(baseDate, count)
  }
  if (
    'duration_in_months' in discount &&
    typeof discount.duration_in_months === 'number'
  ) {
    return addMonths(baseDate, discount.duration_in_months)
  }
  return baseDate
}

export interface CheckoutPricingBreakdownProps {
  checkout: schemas['CheckoutPublic']
  locale?: AcceptedLocale
}

const CheckoutPricingBreakdown = ({
  checkout,
  locale = DEFAULT_LOCALE,
}: CheckoutPricingBreakdownProps) => {
  const t = useTranslations(locale)

  const interval = hasProductCheckout(checkout)
    ? isLegacyRecurringProductPrice(checkout.product_price)
      ? checkout.product_price.recurring_interval
      : checkout.product.recurring_interval
    : null
  const intervalCount = hasProductCheckout(checkout)
    ? checkout.product.recurring_interval_count
    : null

  const { product, prices, currency } = checkout
  const meteredPrices = useMemo(
    () =>
      product && prices ? getMeteredPrices(prices[product.id], currency) : [],
    [product, prices, currency],
  )

  const discountEndLabel = useMemo(() => {
    if (!checkout.discount || checkout.discount.duration === 'forever') {
      return ''
    }

    const baseDate = checkout.trial_end
      ? new Date(checkout.trial_end)
      : new Date()

    const endDate = getDiscountEndDate(
      baseDate,
      checkout.discount,
      interval,
      intervalCount,
    )

    return t('checkout.pricing.discount.until', {
      date: formatShortDate(endDate, locale),
    })
  }, [
    checkout.discount,
    checkout.trial_end,
    interval,
    intervalCount,
    t,
    locale,
  ])

  const totalLabel = useMemo(() => {
    if (!interval) return t('checkout.pricing.total')

    const count = intervalCount ?? 1
    switch (interval) {
      case 'day':
        return t('checkout.pricing.everyInterval.day', { count })
      case 'week':
        return t('checkout.pricing.everyInterval.week', { count })
      case 'month':
        return t('checkout.pricing.everyInterval.month', { count })
      case 'year':
        return t('checkout.pricing.everyInterval.year', { count })
      default:
        unreachable(interval)
    }
  }, [interval, intervalCount, t])

  if (checkout.is_free_product_price) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-2">
      {checkout.currency ? (
        <>
          <DetailRow
            title={t('checkout.pricing.subtotal')}
            className="text-gray-600"
          >
            <AmountLabel
              amount={checkout.amount}
              currency={checkout.currency}
              interval={interval}
              intervalCount={intervalCount}
              mode="standard"
              locale={locale}
            />
          </DetailRow>

          {checkout.discount && (
            <>
              <DetailRow
                title={`${checkout.discount.name}${checkout.discount.type === 'percentage' ? ` (${getDiscountDisplay(checkout.discount, locale)})` : ''}`}
                subtitle={discountEndLabel || undefined}
                className="text-gray-600"
              >
                {formatCurrency('standard', locale)(
                  -checkout.discount_amount,
                  checkout.currency,
                )}
              </DetailRow>
              <DetailRow
                title={t('checkout.pricing.taxableAmount')}
                className="text-gray-600"
              >
                {formatCurrency('standard', locale)(
                  checkout.net_amount,
                  checkout.currency,
                )}
              </DetailRow>
            </>
          )}

          <DetailRow
            title={t('checkout.pricing.taxes')}
            className="text-gray-600"
          >
            {checkout.tax_amount !== null
              ? formatCurrency('standard', locale)(
                  checkout.tax_amount,
                  checkout.currency,
                )
              : '—'}
          </DetailRow>

          <DetailRow title={totalLabel} emphasis>
            <AmountLabel
              amount={checkout.total_amount}
              currency={checkout.currency}
              interval={interval}
              intervalCount={intervalCount}
              mode="standard"
              locale={locale}
            />
          </DetailRow>
          {meteredPrices.length > 0 && (
            <DetailRow
              title={t('checkout.pricing.additionalMeteredUsage')}
              emphasis
            />
          )}
          {meteredPrices.map((meteredPrice) => (
            <DetailRow
              title={meteredPrice.meter.name}
              key={meteredPrice.id}
              className="text-gray-600"
            >
              <MeteredPriceLabel price={meteredPrice} locale={locale} />
            </DetailRow>
          ))}
        </>
      ) : (
        <span>{t('checkout.pricing.free')}</span>
      )}
    </div>
  )
}

export default CheckoutPricingBreakdown
