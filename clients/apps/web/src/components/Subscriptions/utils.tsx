import { components } from '@polar-sh/client'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export const subscriptionStatusDisplayNames: {
  [key in components['schemas']['SubscriptionStatus']]: string
} = {
  incomplete: 'Incomplete',
  incomplete_expired: 'Incomplete',
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
}

export const hasRecurringInterval =
  (recurringInterval: components['schemas']['SubscriptionRecurringInterval']) =>
  (
    subscriptionTier: components['schemas']['ProductStorefront'],
  ): subscriptionTier is components['schemas']['ProductStorefront'] & {
    prices: components['schemas']['ProductPriceRecurring'][]
  } => {
    return subscriptionTier.prices?.some(
      (price) =>
        price.type === 'recurring' &&
        price.recurring_interval === recurringInterval,
    )
  }

export const SubscriptionStatusLabel = ({
  className,
  subscription,
}: {
  className?: string
  subscription:
    | components['schemas']['Subscription']
    | components['schemas']['CustomerSubscription']
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
  subscriptionTier: Partial<components['schemas']['ProductStorefront']>,
  recurringInterval: components['schemas']['SubscriptionRecurringInterval'],
): components['schemas']['ProductPriceRecurring'] | undefined => {
  return subscriptionTier.prices?.find(
    (price) =>
      price.type === 'recurring' &&
      price.recurring_interval === recurringInterval,
  ) as components['schemas']['ProductPriceRecurring'] | undefined
}

export const getRecurringBillingLabel = (
  recurringInterval: components['schemas']['SubscriptionRecurringInterval'],
) => {
  switch (recurringInterval) {
    case 'month':
      return '/mo'
    case 'year':
      return '/year'
  }
}
