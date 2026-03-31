'use client'

import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { formatDate } from '@polar-sh/i18n/formatters/date'
import { addDays, addMonths, addWeeks, addYears } from 'date-fns'
import { useMemo } from 'react'
import { hasProductCheckout, isLegacyRecurringProductPrice } from '../guards'
import { getSeatRows } from '../utils/seats'
import { getDiscountDisplay } from '../utils/discount'
import { getMeteredPrices } from '../utils/product'
import { unreachable } from '../utils/unreachable'
import AmountLabel from './AmountLabel'
import DetailRow from './DetailRow'
import MeteredPriceLabel from './MeteredPriceLabel'

function formatShortDate(date: Date, locale: AcceptedLocale): string {
  const isCurrentYear = date.getFullYear() === new Date().getFullYear()
  return formatDate(date, locale, {
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  })
}

function addInterval(date: Date, interval: string, count: number | null): Date {
  const c = count ?? 1
  switch (interval) {
    case 'day':
      return addDays(date, c)
    case 'week':
      return addWeeks(date, c)
    case 'month':
      return addMonths(date, c)
    case 'year':
      return addYears(date, c)
    default:
      return addMonths(date, c)
  }
}

function getDiscountEndDate(
  baseDate: Date,
  discount: NonNullable<schemas['CheckoutPublic']['discount']>,
  interval: string | null,
  intervalCount: number | null,
): Date {
  if (discount.duration === 'once') {
    return interval
      ? addInterval(baseDate, interval, intervalCount)
      : addMonths(baseDate, intervalCount ?? 1)
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

    if (!interval) {
      return ''
    }

    const baseDate = checkout.trial_end
      ? new Date(checkout.trial_end)
      : new Date()

    if (
      'duration_in_months' in checkout.discount &&
      typeof checkout.discount.duration_in_months === 'number'
    ) {
      const discountEnd = addMonths(
        baseDate,
        checkout.discount.duration_in_months,
      )
      const nextCycle = addInterval(baseDate, interval, intervalCount)
      if (discountEnd <= nextCycle) {
        return ''
      }
    }

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

  const seatRows = useMemo(() => getSeatRows(checkout), [checkout])

  if (checkout.is_free_product_price) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-2">
      {checkout.currency ? (
        <>
          {seatRows?.map((row, i) => (
            <DetailRow
              key={i}
              title={t('checkout.pricing.seats.count', { count: row.seats })}
              subtitle={
                '· ' +
                formatCurrency('standard', locale)(
                  row.pricePerSeat,
                  checkout.currency!,
                ) +
                ' ' +
                t('checkout.pricing.perSeat')
              }
              className="text-gray-600"
            >
              <AmountLabel
                amount={row.seats * row.pricePerSeat}
                currency={checkout.currency!}
                interval={interval}
                intervalCount={intervalCount}
                mode="standard"
                locale={locale}
              />
            </DetailRow>
          ))}
          <DetailRow
            title={t('checkout.pricing.subtotal')}
            className="text-gray-600"
          >
            <AmountLabel
              amount={
                checkout.tax_behavior === 'inclusive' &&
                checkout.tax_amount !== null
                  ? checkout.total_amount - checkout.tax_amount
                  : checkout.amount
              }
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
            title={
              checkout.tax_behavior === 'inclusive'
                ? t('checkout.pricing.inclTax')
                : t('checkout.pricing.taxes')
            }
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
            <DetailRow title={t('checkout.pricing.additionalMeteredUsage')} />
          )}
          {meteredPrices.map((meteredPrice) => (
            <DetailRow
              title={meteredPrice.meter.name}
              key={meteredPrice.id}
              emphasis
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
