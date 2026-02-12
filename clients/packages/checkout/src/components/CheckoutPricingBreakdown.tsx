'use client'

import { formatCurrency } from '@polar-sh/currency'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { PropsWithChildren, useMemo } from 'react'
import { hasProductCheckout } from '../guards'
import {
  formatRecurringInterval,
  getMeteredPrices,
  hasLegacyRecurringPrices,
} from '../utils/product'
import { getDiscountDisplay } from '../utils/discount'
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
}

const CheckoutPricingBreakdown = ({
  checkout,
}: CheckoutPricingBreakdownProps) => {
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

    if (checkout.discount.duration === 'once') {
      if (intervalCount && intervalCount > 1) {
        const pluralInterval = `${interval}${intervalCount > 1 ? 's' : ''}`
        return `for the first ${intervalCount} ${pluralInterval}`
      }
      return `for the first ${interval}`
    }

    const durationInMonths =
      'durationInMonths' in checkout.discount && checkout.discount
        ? checkout.discount.durationInMonths
        : -1

    const calculatedDuration =
      interval === 'year' ? Math.ceil(durationInMonths / 12) : durationInMonths

    if (calculatedDuration <= 1) {
      if (intervalCount && intervalCount > 1) {
        const pluralInterval = `${interval}${intervalCount > 1 ? 's' : ''}`
        return `for the first ${intervalCount} ${pluralInterval}`
      }
      return `for the first ${interval}`
    }

    return `for the first ${calculatedDuration} ${interval === 'year' ? 'years' : 'months'}`
  }, [checkout.discount, interval, intervalCount])

  const totalLabel = useMemo(() => {
    if (interval) {
      const formatted = formatRecurringInterval(interval, intervalCount, 'long')
      return `Every ${formatted}`
    }

    return 'Total'
  }, [interval, intervalCount])

  if (checkout.isFreeProductPrice) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-2">
      {checkout.currency ? (
        <>
          <DetailRow title="Subtotal">
            <AmountLabel
              amount={checkout.amount}
              currency={checkout.currency}
              interval={interval}
              intervalCount={intervalCount}
              mode="standard"
            />
          </DetailRow>

          {checkout.discount && (
            <>
              <DetailRow
                title={`${checkout.discount.name}${checkout.discount.type === 'percentage' ? ` (${getDiscountDisplay(checkout.discount)})` : ''}`}
              >
                {formatCurrency('standard')(
                  -checkout.discountAmount,
                  checkout.currency,
                )}
              </DetailRow>
              <DetailRow title="Taxable amount">
                {formatCurrency('standard')(
                  checkout.netAmount,
                  checkout.currency,
                )}
              </DetailRow>
            </>
          )}

          <DetailRow title="Taxes">
            {checkout.taxAmount !== null
              ? formatCurrency('standard')(checkout.taxAmount, checkout.currency)
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
              />
              {formattedDiscountDuration && (
                <span className="text-xs font-normal text-gray-500">
                  {formattedDiscountDuration}
                </span>
              )}
            </div>
          </DetailRow>
          {meteredPrices.length > 0 && (
            <DetailRow title="Additional metered usage" emphasis />
          )}
          {meteredPrices.map((meteredPrice) => (
            <DetailRow title={meteredPrice.meter.name} key={meteredPrice.id}>
              <MeteredPriceLabel price={meteredPrice} />
            </DetailRow>
          ))}
        </>
      ) : (
        <span>Free</span>
      )}
      {(checkout.trialEnd ||
        (checkout.activeTrialInterval && checkout.activeTrialIntervalCount)) && (
        <div className="dark:border-polar-700 mt-3 border-t border-gray-300 pt-4">
          {checkout.activeTrialInterval && checkout.activeTrialIntervalCount && (
            <DetailRow
              emphasis
              title={`${checkout.activeTrialIntervalCount} ${checkout.activeTrialInterval}${checkout.activeTrialIntervalCount > 1 ? 's' : ''} trial`}
            >
              <span>Free</span>
            </DetailRow>
          )}
          {checkout.trialEnd && (
            <span className="dark:text-polar-500 text-gray-500:w text-sm">
              Trial ends{' '}
              <FormattedDateTime datetime={checkout.trialEnd} resolution="day" />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default CheckoutPricingBreakdown
