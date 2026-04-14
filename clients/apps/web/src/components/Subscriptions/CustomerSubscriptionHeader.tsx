import AmountLabel from '@/components/Shared/AmountLabel'
import { useProduct } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { useMemo } from 'react'
import {
  getCustomerSubscriptionBasePrice,
  getPendingTotalAmount,
} from './pricing'

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

  const pendingSeats = pendingUpdate?.seats ?? subscription.seats ?? 1
  const pendingAmount = useMemo(() => {
    if (!pendingProduct || !subscription.currency) return null
    return getPendingTotalAmount(
      pendingProduct,
      subscription.currency,
      pendingSeats,
    )
  }, [pendingProduct, subscription.currency, pendingSeats])

  if (pendingProduct) {
    return (
      <div className="flex flex-col gap-y-1">
        <div className="flex flex-row items-baseline gap-x-6 text-gray-400 line-through">
          <h3 className="truncate text-xl">{subscription.product.name}</h3>
          <div className="text-xl">
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
        <div className="flex flex-row items-baseline gap-x-6">
          <h3 className="truncate text-xl">{pendingProduct.name}</h3>
          <div className="dark:text-polar-500 text-xl text-gray-500">
            {pendingAmount !== null ? (
              <AmountLabel
                amount={pendingAmount}
                currency={subscription.currency}
                interval={pendingProduct.recurring_interval ?? undefined}
                intervalCount={
                  pendingProduct.recurring_interval_count ?? undefined
                }
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
