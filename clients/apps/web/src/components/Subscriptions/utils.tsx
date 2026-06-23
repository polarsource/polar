import { schemas } from '@polar-sh/client'
import type { PillColor } from '@polar-sh/orbit'
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

export const getSubscriptionStatusColor = (
  status: schemas['SubscriptionStatus'],
  isEnding = false,
): PillColor => {
  switch (status) {
    case 'active':
      return isEnding ? 'yellow' : 'green'
    case 'trialing':
      return 'blue'
    case 'past_due':
      return 'yellow'
    case 'unpaid':
    case 'canceled':
      return 'red'
    default:
      return 'gray'
  }
}

const STATUS_BORDER_COLOR: Record<PillColor, string> = {
  green: 'border-emerald-500',
  yellow: 'border-yellow-500',
  red: 'border-red-500',
  blue: 'border-blue-500',
  gray: 'dark:border-polar-500 border-gray-500',
  purple: 'border-purple-500',
}

export const getSubscriptionStatusBorderColor = (
  status: schemas['SubscriptionStatus'],
  isEnding = false,
): string => STATUS_BORDER_COLOR[getSubscriptionStatusColor(status, isEnding)]

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

  const statusColor = useMemo(
    () =>
      getSubscriptionStatusBorderColor(
        subscription.status,
        subscription.cancel_at_period_end,
      ),
    [subscription.status, subscription.cancel_at_period_end],
  )

  return (
    <div className={twMerge('flex flex-row items-center gap-x-2', className)}>
      <span className={twMerge('h-2 w-2 rounded-full border-2', statusColor)} />
      <span className="capitalize">{label}</span>
    </div>
  )
}
