import { useCustomerSubscriptionMeterChargePreview } from '@/hooks/queries/customerPortal'
import { billsUsageOnMeterCycle } from '@/utils/subscription'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { OverviewSummaryCard } from './OverviewSummaryCard'

interface UpcomingUsageChargeProps {
  subscription: schemas['CustomerSubscription']
  api: Client
}

export const UpcomingUsageCharge = ({
  subscription,
  api,
}: UpcomingUsageChargeProps) => {
  const meters = subscription.meters.filter((meter) => meter.amount > 0)
  const showsCharge = billsUsageOnMeterCycle(subscription) && meters.length > 0

  const { data: preview } = useCustomerSubscriptionMeterChargePreview(
    api,
    subscription.id,
    showsCharge,
  )

  if (!showsCharge) {
    return null
  }

  const hasTaxes = preview && preview.tax_amount > 0
  const hasDiscount = preview && preview.discount_amount > 0

  const chargeDateLabel = `Next Invoice — ${
    subscription.current_meter_period_end
      ? new Date(subscription.current_meter_period_end).toLocaleDateString(
          'en-US',
          { dateStyle: 'medium' },
        )
      : 'N/A'
  }`

  return (
    <OverviewSummaryCard title="Upcoming Usage Charge" meta={chargeDateLabel}>
      {meters.map((meter) => (
        <div key={meter.id} className="flex items-center justify-between">
          <span className="dark:text-polar-400 text-gray-600">
            {meter.meter.name}
          </span>
          <span className="font-medium">
            {formatCurrency('compact')(meter.amount, subscription.currency)}
          </span>
        </div>
      ))}

      <div className="dark:border-polar-700 mt-2 border-t border-gray-200 pt-2">
        {(hasTaxes || hasDiscount) && (
          <div className="dark:text-polar-500 mb-1.5 flex items-center justify-between text-gray-500">
            <span>Subtotal</span>
            <span>
              {formatCurrency('compact')(
                preview.subtotal_amount,
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
                -1 * preview.discount_amount,
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
                preview.tax_amount,
                subscription.currency,
              )}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="font-medium">Estimated Total</span>
          <span className="text-lg font-medium">
            {preview ? (
              formatCurrency('compact')(
                preview.total_amount,
                subscription.currency,
              )
            ) : (
              <span className="dark:text-polar-500 animate-pulse text-gray-500">
                Loading…
              </span>
            )}
          </span>
        </div>

        <p className="max-w-sm text-xs text-gray-500">
          {subscription.status === 'trialing'
            ? 'Final amount may vary based on usage during the trial period.'
            : 'Final amount may vary based on usage until the end of the usage period.'}
        </p>
      </div>
    </OverviewSummaryCard>
  )
}
