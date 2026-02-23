'use client'

import { formatCurrency } from '@polar-sh/currency'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { formatDate } from '@polar-sh/i18n/formatters/date'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import { PropsWithChildren, useMemo } from 'react'
import { hasProductCheckout } from '../guards'
import { getDiscountDisplay } from '../utils/discount'
import { getMeteredPrices, hasLegacyRecurringPrices } from '../utils/product'
import { unreachable } from '../utils/unreachable'
import AmountLabel from './AmountLabel'
import MeteredPriceLabel from './MeteredPriceLabel'

const DetailRow = ({
  title,
  emphasis,
  children,
}: PropsWithChildren<{ title: string; emphasis?: boolean }>) => {
  return (
    <div
      className={`flex flex-row items-start justify-between gap-x-8 ${emphasis ? 'font-medium' : 'dark:text-polar-500 text-gray-500'}`}
    >
      <span className="min-w-0 truncate">{title}</span>
      <span className="shrink-0">{children}</span>
    </div>
  )
}

export interface CheckoutPricingBreakdownProps {
  checkout: CheckoutPublic
  locale?: AcceptedLocale
}

const CheckoutPricingBreakdown = ({
  checkout,
  locale = DEFAULT_LOCALE,
}: CheckoutPricingBreakdownProps) => {
  const t = useTranslations(locale)

  const interval = hasProductCheckout(checkout)
    ? hasLegacyRecurringPrices(checkout.prices[checkout.product.id])
      ? checkout.productPrice.recurringInterval
      : checkout.product.recurringInterval
    : null
  const intervalCount = hasProductCheckout(checkout)
    ? checkout.product.recurringIntervalCount
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
      'durationInMonths' in checkout.discount && checkout.discount
        ? checkout.discount.durationInMonths
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

  if (checkout.isFreeProductPrice) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-2">
      {checkout.currency ? (
        <>
          <DetailRow title={t('checkout.pricing.subtotal')}>
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
              >
                {formatCurrency('standard', locale)(
                  -checkout.discountAmount,
                  checkout.currency,
                )}
              </DetailRow>
              <DetailRow title={t('checkout.pricing.taxableAmount')}>
                {formatCurrency('standard', locale)(
                  checkout.netAmount,
                  checkout.currency,
                )}
              </DetailRow>
            </>
          )}

          <DetailRow title={t('checkout.pricing.taxes')}>
            {checkout.taxAmount !== null
              ? formatCurrency('standard', locale)(
                  checkout.taxAmount,
                  checkout.currency,
                )
              : '—'}
          </DetailRow>

          <DetailRow title={totalLabel} emphasis>
            <div className="flex flex-col items-end gap-y-1">
              <AmountLabel
                amount={checkout.totalAmount}
                currency={checkout.currency}
                interval={interval}
                intervalCount={intervalCount}
                mode="standard"
                locale={locale}
              />
              {formattedDiscountDuration && (
                <span className="text-xs font-normal text-gray-500">
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
            <DetailRow title={meteredPrice.meter.name} key={meteredPrice.id}>
              <MeteredPriceLabel price={meteredPrice} locale={locale} />
            </DetailRow>
          ))}
        </>
      ) : (
        <span>{t('checkout.pricing.free')}</span>
      )}
      {(checkout.trialEnd ||
        (checkout.activeTrialInterval &&
          checkout.activeTrialIntervalCount)) && (
        <div className="dark:border-polar-700 mt-3 border-t border-gray-300 pt-4">
          {checkout.activeTrialInterval &&
            checkout.activeTrialIntervalCount && (
              <DetailRow
                emphasis
                title={
                  checkout.activeTrialInterval === 'year'
                    ? t('checkout.trial.duration.years', {
                        count: checkout.activeTrialIntervalCount,
                      })
                    : checkout.activeTrialInterval === 'month'
                      ? t('checkout.trial.duration.months', {
                          count: checkout.activeTrialIntervalCount,
                        })
                      : checkout.activeTrialInterval === 'week'
                        ? t('checkout.trial.duration.weeks', {
                            count: checkout.activeTrialIntervalCount,
                          })
                        : t('checkout.trial.duration.days', {
                            count: checkout.activeTrialIntervalCount,
                          })
                }
              >
                <span>{t('checkout.pricing.free')}</span>
              </DetailRow>
            )}
          {checkout.trialEnd && (
            <span className="dark:text-polar-500 text-sm text-gray-500">
              {t('checkout.trial.ends', {
                endDate: formatDate(checkout.trialEnd, locale),
              })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default CheckoutPricingBreakdown
