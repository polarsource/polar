import AmountLabel from '@/components/Shared/AmountLabel'
import { useProduct } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { useMemo } from 'react'
import { getCustomerSubscriptionBasePrice } from './pricing'

export const CustomerSubscriptionHeader = ({
  subscription,
}: {
  subscription: schemas['CustomerSubscription']
}) => {
  const pendingUpdate = subscription.pending_update
  const { data: pendingProduct } = useProduct(
    pendingUpdate?.product_id ?? undefined,
  )

  const subscriptionBasePrice = useMemo(
    () => getCustomerSubscriptionBasePrice(subscription),
    [subscription],
  )

  if (pendingProduct) {
    return (
      <div className="flex flex-col gap-y-1">
        <div className="flex flex-row items-baseline gap-x-6">
          <h3 className="truncate text-xl">{subscription.product.name}</h3>
          <div className="dark:text-polar-500 text-xl text-gray-500">
            {subscription.amount && subscription.currency ? (
              <AmountLabel
                amount={subscription.amount}
                currency={subscription.currency}
                interval={subscription.recurring_interval}
                intervalCount={subscription.recurring_interval_count}
              />
            ) : (
              <span>Free</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-row items-baseline gap-x-6">
      <h3 className="truncate text-xl">{subscription.product.name}</h3>
      <div className="dark:text-polar-500 text-xl text-gray-500">
        {subscription.amount && subscription.currency ? (
          <span className="flex flex-row justify-end gap-x-1">
            {subscriptionBasePrice &&
              subscription.amount !== subscriptionBasePrice.amount && (
                <span className="text-gray-500 line-through">
                  {formatCurrency('compact')(
                    subscriptionBasePrice.amount,
                    subscriptionBasePrice.currency,
                  )}
                </span>
              )}
            <AmountLabel
              amount={subscription.amount}
              currency={subscription.currency}
              interval={subscription.recurring_interval}
              intervalCount={subscription.recurring_interval_count}
            />
          </span>
        ) : (
          <span>Free</span>
        )}
      </div>
    </div>
  )
}
