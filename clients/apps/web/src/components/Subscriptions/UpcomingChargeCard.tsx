'use client'

import { DetailRow } from '@/components/Shared/DetailRow'
import { useSubscriptionChargePreview } from '@/hooks/queries/subscriptions'
import { formatCurrency } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'

const UpcomingChargeCard = ({
  subscription,
}: {
  subscription: schemas['Subscription']
}) => {
  const { data: chargePreview, isFetching } = useSubscriptionChargePreview(
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

  const isFreeProduct = subscription.prices.some(
    (price) => price.amount_type === 'free',
  )

  const hasMeters = subscription.meters.length > 0
  const hasTaxes = chargePreview && chargePreview.tax_amount > 0
  const hasDiscount = chargePreview && chargePreview.discount_amount > 0

  const chargeDate = isTrialing
    ? subscription.trial_end
    : subscription.current_period_end

  // Determine header and label based on subscription state
  let headerTitle = 'Upcoming Charge'
  let dateLabel = 'Next Invoice'

  if (isTrialing) {
    headerTitle = 'First Charge After Trial'
    dateLabel = 'Trial Ends'
  } else if (isCancelingAtPeriodEnd) {
    headerTitle = 'Final Charge'
    dateLabel = 'Subscription Ends'
  }

  const hasNextInvoice = !isFreeProduct || hasMeters

  if (!hasNextInvoice) {
    return null
  }

  return (
    <ShadowBox className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200 border-gray-200 bg-transparent p-0 md:rounded-3xl!">
      <div className="flex flex-col gap-6 p-8">
        <div className="items-center justify-between space-y-1.5 sm:flex sm:space-y-0">
          <h3 className="text-lg font-medium">{headerTitle}</h3>
          <span className="text-sm text-gray-500">
            {dateLabel} —{' '}
            {chargeDate
              ? new Date(chargeDate).toLocaleDateString('en-US', {
                  dateStyle: 'medium',
                })
              : 'N/A'}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <DetailRow
            label={subscription.product.name}
            value={
              isCancelingAtPeriodEnd ? (
                <span className="text-gray-500">Canceled</span>
              ) : (
                formatCurrency(subscription.amount, subscription.currency)
              )
            }
          />

          {hasMeters && (
            <>
              <div className="mt-2">
                <span className="font-medium">Metered Charges</span>
              </div>

              {subscription.meters.map((meter) => (
                <DetailRow
                  key={meter.id}
                  label={meter.meter.name}
                  value={formatCurrency(meter.amount, subscription.currency)}
                />
              ))}
            </>
          )}

          <div className="dark:border-polar-700 mt-2 border-t border-gray-200 pt-2">
            {isFetching ? (
              <div className="flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className="dark:text-polar-500 animate-pulse text-gray-500">
                  Loading…
                </span>
              </div>
            ) : (
              chargePreview && (
                <>
                  {(hasTaxes || hasDiscount) && (
                    <DetailRow
                      label="Subtotal"
                      value={formatCurrency(
                        chargePreview.subtotal_amount,
                        subscription.currency,
                      )}
                      valueClassName="dark:text-polar-500 text-gray-500"
                      labelClassName="dark:text-polar-500 text-gray-500"
                    />
                  )}

                  {hasDiscount && (
                    <DetailRow
                      label="Discount"
                      value={formatCurrency(
                        -1 * chargePreview.discount_amount,
                        subscription.currency,
                      )}
                      valueClassName="dark:text-polar-500 text-gray-500"
                      labelClassName="dark:text-polar-500 text-gray-500"
                    />
                  )}

                  {hasTaxes && (
                    <DetailRow
                      label="Taxes"
                      value={formatCurrency(
                        chargePreview.tax_amount,
                        subscription.currency,
                      )}
                      valueClassName="dark:text-polar-500 text-gray-500"
                      labelClassName="dark:text-polar-500 text-gray-500"
                    />
                  )}

                  <DetailRow
                    label={[
                      hasMeters && 'Estimated',
                      isCancelingAtPeriodEnd ? 'Final Charge' : 'Total',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    value={
                      <span className="text-lg font-semibold">
                        {formatCurrency(
                          chargePreview.total_amount,
                          subscription.currency,
                        )}
                      </span>
                    }
                    valueClassName="font-medium"
                    labelClassName="font-medium dark:text-white"
                  />

                  {isCancelingAtPeriodEnd && (
                    <p className="max-w-sm text-xs text-gray-500">
                      This will be the final charge when the subscription ends.
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
                </>
              )
            )}
          </div>
        </div>
      </div>
    </ShadowBox>
  )
}

export default UpcomingChargeCard
