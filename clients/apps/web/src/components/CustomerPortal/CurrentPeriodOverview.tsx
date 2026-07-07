import { useCustomerSubscriptionChargePreview } from '@/hooks/queries/customerPortal'
import { isFreePrice, isSeatBasedPrice } from '@/utils/product'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { useMemo } from 'react'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import { OverviewSummaryCard } from './OverviewSummaryCard'

interface CurrentPeriodOverviewProps {
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
  api: Client
}

export const CurrentPeriodOverview = ({
  subscription,
  products,
  api,
}: CurrentPeriodOverviewProps) => {
  const { data: subscriptionPreview } = useCustomerSubscriptionChargePreview(
    api,
    subscription.id,
  )
  const productId = useMemo(() => {
    if (subscription.pending_update && subscription.pending_update.product_id) {
      return subscription.pending_update.product_id
    }
    return subscription.product_id
  }, [subscription])
  const product = products.find((product) => product.id === productId)

  // For seat-based subscriptions, surface the number of seats we'll charge for
  // next, preferring a pending update if one is scheduled.
  const seats = useMemo(() => {
    if (
      subscription.pending_update &&
      subscription.pending_update.seats != null
    ) {
      return subscription.pending_update.seats
    }
    return subscription.seats
  }, [subscription])

  const isTrialing = subscription.status === 'trialing'
  const isActive = subscription.status === 'active'
  const isCancelingAtPeriodEnd =
    subscription.cancel_at_period_end && !subscription.ended_at

  // Show for active, trialing, or subscriptions set to cancel at period end.
  // A scheduled pause has no next charge (it pauses instead), so hide it.
  if ((!isActive && !isTrialing) || subscription.pause_at_period_end) {
    return null
  }

  const hasMeters = subscription.meters.length > 0
  const prorations = subscriptionPreview?.prorations ?? []
  const hasProrations = prorations.length > 0
  const hasTaxes = subscriptionPreview && subscriptionPreview.tax_amount > 0
  const hasDiscount =
    subscriptionPreview && subscriptionPreview.discount_amount > 0

  const isFreeProduct = subscription.prices.some(isFreePrice)

  const isSeatBasedProduct = product?.prices.some(
    (price) =>
      price.price_currency === subscription.currency && isSeatBasedPrice(price),
  )

  // For subscriptions set to cancel, only show if there's still something to
  // bill: metered usage or pending prorations.
  if (isCancelingAtPeriodEnd && !hasMeters && !hasProrations) {
    return null
  }

  // Don't show for free subscriptions with no meters
  const hasNextInvoice = !isFreeProduct || hasMeters
  if (!hasNextInvoice) {
    return null
  }

  const chargeDate = isTrialing
    ? subscription.trial_end
    : subscription.current_period_end

  // Determine header and label based on subscription state
  let headerTitle = 'Next Charge'
  let dateLabel = 'Next Invoice'

  if (isTrialing) {
    headerTitle = 'First Charge After Trial'
    dateLabel = 'Trial Ends'
  } else if (isCancelingAtPeriodEnd) {
    headerTitle = 'Final Charge'
    dateLabel = 'Subscription Ends'
  }

  const chargeDateLabel = `${dateLabel} — ${
    chargeDate
      ? new Date(chargeDate).toLocaleDateString('en-US', {
          dateStyle: 'medium',
        })
      : 'N/A'
  }`

  return (
    <OverviewSummaryCard title={headerTitle} meta={chargeDateLabel}>
      {product && subscriptionPreview && (
        <div className="flex items-center justify-between">
          <span className="dark:text-polar-400 text-gray-600">
            {isSeatBasedProduct && seats != null
              ? `${product.name} (${seats} ${seats === 1 ? 'seat' : 'seats'})`
              : product.name}
          </span>
          <span
            className={isCancelingAtPeriodEnd ? 'text-gray-500' : 'font-medium'}
          >
            {isCancelingAtPeriodEnd ? (
              'Canceled'
            ) : (
              <ProductPriceLabel
                product={product}
                currency={subscription.currency}
              />
            )}
          </span>
        </div>
      )}

      {hasProrations && (
        <>
          <span className="font-medium">Prorations</span>

          {prorations.map((proration, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="dark:text-polar-400 text-gray-600">
                {proration.label}
              </span>
              <span className="font-medium">
                {formatCurrency('compact')(
                  proration.amount,
                  subscription.currency,
                )}
              </span>
            </div>
          ))}
        </>
      )}

      {hasMeters && (
        <>
          <span className="font-medium">Metered Charges</span>

          {subscription.meters.map((meter) => (
            <div key={meter.id} className="flex items-center justify-between">
              <span className="dark:text-polar-400 text-gray-600">
                {meter.meter.name}
              </span>
              <span className="font-medium">
                {formatCurrency('compact')(meter.amount, subscription.currency)}
              </span>
            </div>
          ))}
        </>
      )}

      <div className="dark:border-polar-700 mt-2 border-t border-gray-200 pt-2">
        {(hasTaxes || hasDiscount) && (
          <div className="dark:text-polar-500 mb-1.5 flex items-center justify-between text-gray-500">
            <span>Subtotal</span>
            <span>
              {formatCurrency('compact')(
                subscriptionPreview.subtotal_amount,
                subscription.currency,
              )}
            </span>
          </div>
        )}

        {hasDiscount && (
          <div className="dark:text-polar-500 mb-1 flex items-center justify-between text-gray-500">
            <span>Discount</span>
            <span>
              {formatCurrency('compact')(
                -1 * subscriptionPreview.discount_amount,
                subscription.currency,
              )}
            </span>
          </div>
        )}

        {hasTaxes && (
          <div className="dark:text-polar-500 mb-1 flex items-center justify-between text-gray-500">
            <span>Taxes</span>
            <span>
              {formatCurrency('compact')(
                subscriptionPreview.tax_amount,
                subscription.currency,
              )}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="font-medium">
            {hasMeters ? 'Estimated Total' : 'Total'}
          </span>
          <span className="text-lg font-medium">
            {subscriptionPreview ? (
              formatCurrency('compact')(
                subscriptionPreview.total_amount,
                subscription.currency,
              )
            ) : (
              <span className="dark:text-polar-500 animate-pulse text-gray-500">
                Loading…
              </span>
            )}
          </span>
        </div>

        {isCancelingAtPeriodEnd && (
          <p className="max-w-sm text-xs text-gray-500">
            This will be the final charge before the subscription ends.
            {hasMeters &&
              ' Final amount may vary based on usage until the end of the billing period.'}
          </p>
        )}

        {!isCancelingAtPeriodEnd && hasMeters && (
          <p className="max-w-sm text-xs text-gray-500">
            {isActive
              ? 'Final charges may vary based on usage until the end of the billing period.'
              : isTrialing
                ? 'Final charges may vary based on usage during the trial period.'
                : 'Final charges may vary.'}
          </p>
        )}
      </div>
    </OverviewSummaryCard>
  )
}
