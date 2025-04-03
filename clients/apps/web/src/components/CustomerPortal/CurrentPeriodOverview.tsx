import { schemas } from '@polar-sh/client'
import ProductPriceLabel from '../Products/ProductPriceLabel'

interface CurrentPeriodOverviewProps {
  subscription: schemas['CustomerSubscription']
}

export const CurrentPeriodOverview = ({
  subscription,
}: CurrentPeriodOverviewProps) => {
  if (subscription.status !== 'active') {
    return null
  }

  console.log(subscription)

  return (
    <div className="dark:border-polar-700 flex flex-col gap-4 rounded-3xl border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium">Current Period Overview</h4>
        <span className="text-sm text-gray-500">
          Next Invoice —{' '}
          {subscription.current_period_end
            ? new Date(subscription.current_period_end).toLocaleDateString(
                'en-US',
                {
                  dateStyle: 'short',
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

        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">
            Usage Charges
          </span>
          <span className="font-medium">$6.00</span>
        </div>

        <div className="dark:border-polar-700 mt-2 border-t border-gray-200 pt-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Estimated Total</span>
            <span className="text-lg font-semibold">$16.00</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        * Final charges may vary based on usage until the end of the billing
        period
      </p>
    </div>
  )
}
