import { useCustomerSubscriptionChargePreview } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import ProductPriceLabel from '../Products/ProductPriceLabel'

interface CurrentPeriodOverviewProps {
  subscription: schemas['CustomerSubscription']
  api: Client
}

export const CurrentPeriodOverview = ({
  subscription,
  api,
}: CurrentPeriodOverviewProps) => {
  const { data: subscriptionPreview } = useCustomerSubscriptionChargePreview(
    api,
    subscription.id,
  )

  const isTrialing = subscription.status === 'trialing'
  const isActive = subscription.status === 'active'
  const isCancelingAtPeriodEnd =
    subscription.cancel_at_period_end && !subscription.ended_at

  // Show for active, trialing, or subscriptions set to cancel at period end
  if (!isActive && !isTrialing) {
    return null
  }

  const hasMeters = subscription.meters.length > 0
  const hasTaxes = subscriptionPreview && subscriptionPreview.tax_amount > 0
  const hasDiscount =
    subscriptionPreview && subscriptionPreview.discount_amount > 0

  const isFreeProduct = subscription.prices.some(
    (price) => price.amount_type === 'free',
  )

  // For subscriptions set to cancel, only show if there are meters
  if (isCancelingAtPeriodEnd && !hasMeters) {
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
  let headerTitle = 'Current Period Overview'
  let dateLabel = 'Next Invoice'

  if (isTrialing) {
    headerTitle = 'First Charge After Trial'
    dateLabel = 'Trial Ends'
  } else if (isCancelingAtPeriodEnd) {
    headerTitle = 'Final Charge'
    dateLabel = 'Subscription Ends'
  }

  return (
    <div className="dark:border-polar-700 flex flex-col gap-4 rounded-3xl border border-gray-200 p-8">
      <div className="items-center justify-between space-y-1.5 sm:flex sm:space-y-0">
        {/* eslint-disable-next-line no-restricted-syntax */}
        <h4 className="text-lg font-medium">{headerTitle}</h4>
        {/* eslint-disable-next-line no-restricted-syntax */}
        <span className="dark:text-polar-500 text-sm text-gray-500">
          {dateLabel} —{' '}
          {chargeDate
            ? new Date(chargeDate).toLocaleDateString('en-US', {
                dateStyle: 'medium',
              })
            : 'N/A'}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <span className="dark:text-polar-400 text-gray-600">
            {subscription.product.name}
          </span>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <span
            className={isCancelingAtPeriodEnd ? 'text-gray-500' : 'font-medium'}
          >
            {isCancelingAtPeriodEnd ? (
              'Canceled'
            ) : (
              <ProductPriceLabel
                product={subscription.product}
                currency={subscription.currency}
              />
            )}
          </span>
        </div>

        {hasMeters && (
          <>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <span className="font-medium">Metered Charges</span>

            {subscription.meters.map((meter) => (
              <div key={meter.id} className="flex items-center justify-between">
                {/* eslint-disable-next-line no-restricted-syntax */}
                <span className="dark:text-polar-400 text-gray-600">
                  {meter.meter.name}
                </span>
                {/* eslint-disable-next-line no-restricted-syntax */}
                <span className="font-medium">
                  {formatCurrency('compact')(
                    meter.amount,
                    subscription.currency,
                  )}
                </span>
              </div>
            ))}
          </>
        )}

        <div className="dark:border-polar-700 mt-2 border-t border-gray-200 pt-2">
          {(hasTaxes || hasDiscount) && (
            <div className="dark:text-polar-500 mb-1.5 flex items-center justify-between text-gray-500">
              {/* eslint-disable-next-line no-restricted-syntax */}
              <span>Subtotal</span>
              {/* eslint-disable-next-line no-restricted-syntax */}
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
              {/* eslint-disable-next-line no-restricted-syntax */}
              <span>Discount</span>
              {/* eslint-disable-next-line no-restricted-syntax */}
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
              {/* eslint-disable-next-line no-restricted-syntax */}
              <span>Taxes</span>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <span>
                {formatCurrency('compact')(
                  subscriptionPreview.tax_amount,
                  subscription.currency,
                )}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* eslint-disable-next-line no-restricted-syntax */}
            <span className="font-medium">
              {hasMeters ? 'Estimated Total' : 'Total'}
            </span>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <span className="text-lg font-medium">
              {subscriptionPreview ? (
                formatCurrency('compact')(
                  subscriptionPreview.total_amount,
                  subscription.currency,
                )
              ) : (
                <>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <span className="dark:text-polar-500 animate-pulse text-gray-500">
                    Loading…
                  </span>
                </>
              )}
            </span>
          </div>

          {isCancelingAtPeriodEnd && (
            <>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <p className="max-w-sm text-xs text-gray-500">
                This will be the final charge before the subscription ends.
                {hasMeters &&
                  ' Final amount may vary based on usage until the end of the billing period.'}
              </p>
            </>
          )}

          {!isCancelingAtPeriodEnd && hasMeters && (
            <>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <p className="max-w-sm text-xs text-gray-500">
                {isActive
                  ? 'Final charges may vary based on usage until the end of the billing period.'
                  : isTrialing
                    ? 'Final charges may vary based on usage during the trial period.'
                    : 'Final charges may vary.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
