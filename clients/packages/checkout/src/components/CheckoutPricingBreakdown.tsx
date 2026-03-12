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
import { PropsWithChildren, useMemo } from 'react'
import { hasProductCheckout, isLegacyRecurringProductPrice } from '../guards'
import { getDiscountDisplay } from '../utils/discount'
import { getMeteredPrices } from '../utils/product'
import { unreachable } from '../utils/unreachable'
import AmountLabel from './AmountLabel'
import MeteredPriceLabel from './MeteredPriceLabel'

const DetailRow = ({
  title,
  emphasis,
  className,
  children,
}: PropsWithChildren<{
  title: string
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
      <span className="min-w-0 truncate">{title}</span>
      <span className="shrink-0">{children}</span>
    </div>
  )
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

  const { product, prices } = checkout
  const meteredPrices = useMemo(
    () => (product && prices ? getMeteredPrices(prices[product.id]) : []),
    [product, prices],
  )

  const formattedDiscountDuration = useMemo(() => {
    if (!checkout.discount) {
      return ''
    }

    if (!interval) {
      return ''
    }

    if (checkout.discount.duration === 'forever') {
      return ''
    }

    const tDiscountDuration = (count: number) =>
      interval === 'year'
        ? t('checkout.pricing.discount.duration.years', { count })
        : t('checkout.pricing.discount.duration.months', { count })

    if (checkout.discount.duration === 'once') {
      if (intervalCount && intervalCount > 1) {
        return tDiscountDuration(intervalCount)
      }
      return tDiscountDuration(1)
    }

    const durationInMonths =
      'duration_in_months' in checkout.discount && checkout.discount
        ? checkout.discount.duration_in_months
        : -1

    const calculatedDuration =
      interval === 'year' ? Math.ceil(durationInMonths / 12) : durationInMonths

    if (calculatedDuration <= 1) {
      if (intervalCount && intervalCount > 1) {
        return tDiscountDuration(intervalCount)
      }
      return tDiscountDuration(1)
    }

    return tDiscountDuration(calculatedDuration)
  }, [checkout.discount, interval, intervalCount, t])

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
            <div className="flex flex-col items-end gap-y-1">
              <AmountLabel
                amount={checkout.total_amount}
                currency={checkout.currency}
                interval={interval}
                intervalCount={intervalCount}
                mode="standard"
                locale={locale}
              />
              {formattedDiscountDuration && (
                <span
                  className={cn(
                    'text-xs font-normal text-gray-500',
                    'text-gray-600',
                  )}
                >
                  {formattedDiscountDuration}
                </span>
              )}
            </div>
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
      {(checkout.trial_end ||
        (checkout.active_trial_interval &&
          checkout.active_trial_interval_count)) && (
        <div className="dark:border-polar-700 mt-3 border-t border-gray-300 pt-4">
          {checkout.active_trial_interval &&
            checkout.active_trial_interval_count && (
              <DetailRow
                emphasis
                title={
                  checkout.active_trial_interval === 'year'
                    ? t('checkout.trial.duration.years', {
                        count: checkout.active_trial_interval_count,
                      })
                    : checkout.active_trial_interval === 'month'
                      ? t('checkout.trial.duration.months', {
                          count: checkout.active_trial_interval_count,
                        })
                      : checkout.active_trial_interval === 'week'
                        ? t('checkout.trial.duration.weeks', {
                            count: checkout.active_trial_interval_count,
                          })
                        : t('checkout.trial.duration.days', {
                            count: checkout.active_trial_interval_count,
                          })
                }
              >
                <span>{t('checkout.pricing.free')}</span>
              </DetailRow>
            )}
          {checkout.trial_end && (
            <span
              className={cn(
                'dark:text-polar-500 text-sm text-gray-500',
                'text-gray-600',
              )}
            >
              {t('checkout.trial.ends', {
                endDate: formatDate(checkout.trial_end, locale),
              })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default CheckoutPricingBreakdown
