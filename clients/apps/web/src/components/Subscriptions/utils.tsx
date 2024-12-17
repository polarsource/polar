import {
    CustomerSubscription,
  ProductPriceRecurring,
  ProductPriceType,
  ProductStorefront,
  Subscription,
  SubscriptionRecurringInterval,
  SubscriptionStatus,
} from '@polar-sh/sdk'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export const subscriptionStatusDisplayNames: {
  [key in SubscriptionStatus]: string
} = {
  [SubscriptionStatus.INCOMPLETE]: 'Incomplete',
  [SubscriptionStatus.INCOMPLETE_EXPIRED]: 'Incomplete',
  [SubscriptionStatus.TRIALING]: 'Trialing',
  [SubscriptionStatus.ACTIVE]: 'Active',
  [SubscriptionStatus.PAST_DUE]: 'Past due',
  [SubscriptionStatus.CANCELED]: 'Canceled',
  [SubscriptionStatus.UNPAID]: 'Unpaid',
}

export const hasRecurringInterval =
  (recurringInterval: SubscriptionRecurringInterval) =>
  (
    subscriptionTier: ProductStorefront,
  ): subscriptionTier is ProductStorefront & {
    prices: ProductPriceRecurring[]
  } => {
    return subscriptionTier.prices?.some(
      (price) =>
        price.type === ProductPriceType.RECURRING &&
        price.recurring_interval === recurringInterval,
    )
  }

export const SubscriptionStatusLabel = ({
  className,
  subscription
}: { className?: string, subscription: Subscription | CustomerSubscription }) => {

  const label = useMemo(() => {

  switch (subscription.status) {
    case 'active':
      return subscription.ends_at ? 'To be cancelled' : 'Active'
    default:
      return subscription.status.split('_').join(' ')
  }
}, [subscription])



const statusColor = useMemo(() => {
    switch (subscription.status) {
      case 'active':
        return subscription.cancel_at_period_end ? 'border-yellow-500' : 'border-emerald-500'
      default:
        return 'border-red-500'
    }
  }, [subscription])


  return (
    <div className={twMerge("flex flex-row items-center gap-x-2", className)}>
      <span className={twMerge('h-2 w-2 rounded-full border-2', statusColor)} />
      <span className="capitalize">{label}</span>
    </div>
  )
}

export const getRecurringProductPrice = (
  subscriptionTier: Partial<ProductStorefront>,
  recurringInterval: SubscriptionRecurringInterval,
): ProductPriceRecurring | undefined => {
  return subscriptionTier.prices?.find(
    (price) =>
      price.type === ProductPriceType.RECURRING &&
      price.recurring_interval === recurringInterval,
  ) as ProductPriceRecurring | undefined
}

export const getRecurringBillingLabel = (
  recurringInterval: SubscriptionRecurringInterval,
) => {
  switch (recurringInterval) {
    case SubscriptionRecurringInterval.MONTH:
      return '/mo'
    case SubscriptionRecurringInterval.YEAR:
      return '/year'
  }
}
