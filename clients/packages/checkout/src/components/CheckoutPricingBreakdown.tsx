'use client'

import { formatCurrency } from '@polar-sh/currency'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import { cn } from '@polar-sh/ui/lib/utils'
import { addMonths, addYears, differenceInDays } from 'date-fns'
import { PropsWithChildren, useMemo } from 'react'
import { hasProductCheckout, isLegacyRecurringProductPrice } from '../guards'
import { getDiscountDisplay } from '../utils/discount'
import { getMeteredPrices } from '../utils/product'
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

function formatRelativeDate(
  date: Date,
  t: ReturnType<typeof useTranslations>,
): string {
  const days = differenceInDays(date, new Date())
  if (days <= 0) return t('checkout.trial.relativeDate.today')
  return t('checkout.trial.relativeDate.inDays', { count: days })
}

function getDiscountEndDate(
  trialEnd: Date,
  discount: NonNullable<CheckoutPublic['discount']>,
  interval: string | null,
  intervalCount: number | null,
): Date {
  if (discount.duration === 'once') {
    const count = intervalCount ?? 1
    return interval === 'year'
      ? addYears(trialEnd, count)
      : addMonths(trialEnd, count)
  }
  if (
    'durationInMonths' in discount &&
    typeof discount.durationInMonths === 'number'
  ) {
    return addMonths(trialEnd, discount.durationInMonths)
  }
  return trialEnd
}

const TrialSummaryRow = ({
  label,
  relativeDate,
  children,
}: PropsWithChildren<{
  label: string
  relativeDate: string | null
}>) => (
  <div className="dark:text-polar-500 flex flex-row items-start justify-between gap-x-8 text-gray-500">
    <span className="min-w-0 truncate">
      {label}
      {relativeDate && (
        <span className="dark:text-polar-600 ml-1 text-gray-400">
          ({relativeDate})
        </span>
      )}
    </span>
    <span className="shrink-0">{children}</span>
  </div>
)

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
    ? isLegacyRecurringProductPrice(checkout.productPrice)
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
        // With Speakeasy's forward compatibility,
        // we can't do exhaustive switches anymore.
        // unreachable(interval)
        return ''
    }
  }, [interval, intervalCount, t])

  if (checkout.isFreeProductPrice) {
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
                  -checkout.discountAmount,
                  checkout.currency,
                )}
              </DetailRow>
              <DetailRow
                title={t('checkout.pricing.taxableAmount')}
                className="text-gray-600"
              >
                {formatCurrency('standard', locale)(
                  checkout.netAmount,
                  checkout.currency,
                )}
              </DetailRow>
            </>
          )}

          <DetailRow
            title={t('checkout.pricing.taxes')}
            className="text-gray-600"
          >
            {checkout.taxAmount !== null
              ? formatCurrency('standard', locale)(
                  checkout.taxAmount,
                  checkout.currency,
                )
              : '—'}
          </DetailRow>

          {!(
            checkout.activeTrialInterval && checkout.activeTrialIntervalCount
          ) && (
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
          )}
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
      {checkout.activeTrialInterval &&
        checkout.activeTrialIntervalCount &&
        checkout.currency && (
          <div className="dark:border-polar-700 mt-3 flex flex-col gap-y-2 border-t border-gray-300 pt-4">
            <TrialSummaryRow
              label={t('checkout.trial.summary.totalWhenTrialEnds')}
              relativeDate={
                checkout.trialEnd
                  ? formatRelativeDate(checkout.trialEnd, t)
                  : null
              }
            >
              <AmountLabel
                amount={checkout.totalAmount}
                currency={checkout.currency}
                interval={interval}
                intervalCount={intervalCount}
                mode="standard"
                locale={locale}
              />
            </TrialSummaryRow>
            {checkout.discount &&
              checkout.discount.duration !== 'forever' &&
              checkout.discountAmount > 0 &&
              checkout.trialEnd && (
                <TrialSummaryRow
                  label={t('checkout.trial.summary.totalWhenDiscountExpires')}
                  relativeDate={formatRelativeDate(
                    getDiscountEndDate(
                      checkout.trialEnd,
                      checkout.discount,
                      interval,
                      intervalCount,
                    ),
                    t,
                  )}
                >
                  <AmountLabel
                    amount={
                      checkout.taxAmount && checkout.netAmount > 0
                        ? checkout.amount +
                          Math.round(
                            checkout.taxAmount *
                              (checkout.amount / checkout.netAmount),
                          )
                        : checkout.amount
                    }
                    currency={checkout.currency}
                    interval={interval}
                    intervalCount={intervalCount}
                    mode="standard"
                    locale={locale}
                  />
                </TrialSummaryRow>
              )}
            <DetailRow
              title={t('checkout.trial.summary.totalDueToday')}
              emphasis
            >
              {formatCurrency('standard', locale)(0, checkout.currency)}
            </DetailRow>
          </div>
        )}
    </div>
  )
}

export default CheckoutPricingBreakdown
