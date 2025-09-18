import { useCustomerSubscriptionChargePreview } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'
import { twMerge } from 'tailwind-merge'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import AmountLabel from '../Shared/AmountLabel'

interface CurrentPeriodOverviewProps {
  subscription: schemas['CustomerSubscription']
  api: Client
}

export const CurrentPeriodOverview = ({
  subscription,
  api,
}: CurrentPeriodOverviewProps) => {
  const themePreset = useThemePreset(
    subscription.product.organization.slug === 'midday' ? 'midday' : 'polar',
  )

  const { data: subscriptionPreview } = useCustomerSubscriptionChargePreview(
    api,
    subscription.id,
  )

  if (subscription.status !== 'active') {
    return null
  }

  const hasMeters = subscription.meters.length > 0
  const hasTaxes = subscriptionPreview && subscriptionPreview.tax_amount > 0
  const hasDiscount =
    subscriptionPreview && subscriptionPreview.discount_amount > 0

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 flex flex-col gap-4 rounded-3xl border border-gray-200 p-8',
        themePreset.polar.wellSecondary,
      )}
    >
      <div className="items-center justify-between space-y-1.5 sm:flex sm:space-y-0">
        <h4 className="text-lg font-medium">Current Period Overview</h4>
        <span className="text-sm text-gray-500">
          Next Invoice —{' '}
          {subscription.current_period_end
            ? new Date(subscription.current_period_end).toLocaleDateString(
                'en-US',
                {
                  dateStyle: 'medium',
                },
              )
            : 'N/A'}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">
            {subscription.product.name}
          </span>
          <span className="font-medium">
            <ProductPriceLabel product={subscription.product} />
          </span>
        </div>

        {hasMeters && (
          <>
            <span className="font-medium">Metered Charges</span>

            {subscription.meters.map((meter) => (
              <div key={meter.id} className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {meter.meter.name}
                </span>
                <span className="font-medium">
                  <AmountLabel
                    amount={meter.amount}
                    currency={subscription.currency}
                    minimumFractionDigits={2}
                  />
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
                <AmountLabel
                  amount={subscriptionPreview.subtotal_amount}
                  currency={subscription.currency}
                  minimumFractionDigits={
                    subscriptionPreview.subtotal_amount % 100 === 0 ? 0 : 2
                  }
                />
              </span>
            </div>
          )}

          {hasDiscount && (
            <div className="dark:text-polar-500 mb-1 flex items-center justify-between text-gray-500">
              <span>Discount</span>
              <span>
                <AmountLabel
                  amount={-1 * subscriptionPreview.discount_amount}
                  currency={subscription.currency}
                  minimumFractionDigits={
                    subscriptionPreview.discount_amount % 100 === 0 ? 0 : 2
                  }
                />
              </span>
            </div>
          )}

          {hasTaxes && (
            <div className="dark:text-polar-500 mb-1 flex items-center justify-between text-gray-500">
              <span>Taxes</span>
              <span>
                <AmountLabel
                  amount={subscriptionPreview.tax_amount}
                  currency={subscription.currency}
                  minimumFractionDigits={
                    subscriptionPreview.tax_amount % 100 === 0 ? 0 : 2
                  }
                />
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-medium">
              {hasMeters ? 'Estimated Total' : 'Total'}
            </span>
            <span className="text-lg font-semibold">
              {subscriptionPreview ? (
                <AmountLabel
                  amount={subscriptionPreview.total_amount}
                  currency={subscription.currency}
                  minimumFractionDigits={
                    subscriptionPreview.total_amount % 100 === 0 ? 0 : 2
                  }
                />
              ) : (
                <span className="dark:bg-polar-700 animate-pulse rounded-md bg-gray-50 text-gray-500 text-opacity-0 dark:text-gray-400">
                  Loading…
                </span>
              )}
            </span>
          </div>

          {hasMeters && (
            <p className="text-xs text-gray-500">
              Final charges may vary based on usage until the end of the billing
              period
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
