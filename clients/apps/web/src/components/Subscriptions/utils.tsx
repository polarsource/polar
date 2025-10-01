import {
  hasLegacyRecurringPrices,
  isLegacyRecurringPrice,
} from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export const subscriptionStatusDisplayNames: {
  [key in schemas['SubscriptionStatus']]: string
} = {
  incomplete: 'Incomplete',
  incomplete_expired: 'Incomplete',
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
}

export const SubscriptionStatusLabel = ({
  className,
  subscription,
}: {
  className?: string
  subscription: schemas['Subscription'] | schemas['CustomerSubscription']
}) => {
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
        return subscription.cancel_at_period_end
          ? 'border-yellow-500'
          : 'border-emerald-500'
      case 'trialing':
        return 'border-cyan-500'
      default:
        return 'border-red-500'
    }
  }, [subscription])

  return (
    <div className={twMerge('flex flex-row items-center gap-x-2', className)}>
      <span className={twMerge('h-2 w-2 rounded-full border-2', statusColor)} />
      <span className="capitalize">{label}</span>
    </div>
  )
}

export const getRecurringProductPrice = (
  subscriptionTier: schemas['ProductStorefront'],
  recurringInterval: schemas['SubscriptionRecurringInterval'],
):
  | schemas['ProductPrice']
  | schemas['LegacyRecurringProductPrice']
  | undefined => {
  if (hasLegacyRecurringPrices(subscriptionTier)) {
    return subscriptionTier.prices.find(
      (price) =>
        isLegacyRecurringPrice(price) &&
        price.recurring_interval === recurringInterval,
    )
  }

  if (subscriptionTier.is_recurring) {
    return subscriptionTier.prices[0]
  }

  return undefined
}

export const getRecurringBillingLabel = (
  recurringInterval: schemas['SubscriptionRecurringInterval'],
) => {
  switch (recurringInterval) {
    case 'day':
      return '/day'
    case 'week':
      return '/week'
    case 'month':
      return '/mo'
    case 'year':
      return '/year'
  }
}
