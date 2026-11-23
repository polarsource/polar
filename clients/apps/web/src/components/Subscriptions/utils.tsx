import { StatusIcon } from '@/components/Shared/StatusIcon'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { twMerge } from 'tailwind-merge'
import { getSubscriptionStatusIcon } from './SubscriptionStatusIcon'

export const subscriptionUpdateValidationDiscriminators = [
  'SubscriptionUpdateBase',
  'SubscriptionUpdateBillingPeriod',
  'SubscriptionUpdateSeats',
]

export const isDiscountApplicableToProduct = (
  discount: schemas['Discount'],
  productId: string,
): boolean =>
  discount.products.length === 0 ||
  discount.products.some((product) => product.id === productId)

export const formatSubscriptionPrice = ({
  amount,
  currency,
  recurring_interval: interval,
  recurring_interval_count: count,
}: schemas['Subscription']): string =>
  `${formatCurrency('compact')(amount, currency)} /${count > 1 ? `${count} ${interval}s` : interval}`

export const subscriptionStatusDisplayNames: {
  [key in schemas['SubscriptionStatus']]: string
} = {
  incomplete: 'Incomplete',
  incomplete_expired: 'Incomplete',
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  paused: 'Paused',
  trial_ended: 'Trial ended',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
}

// A subscription that is still running but set to end or pause is named for
// what is about to happen to it.
export const getSubscriptionStatusLabel = ({
  status,
  ends_at: endsAt,
  pause_at_period_end: pausesAtPeriodEnd,
}: Pick<
  schemas['Subscription'],
  'status' | 'ends_at' | 'pause_at_period_end'
>): string => {
  if (status === 'active' || status === 'trialing') {
    if (endsAt) return 'Canceling'
    if (pausesAtPeriodEnd) return 'Pausing'
  }
  return subscriptionStatusDisplayNames[status]
}

export const SubscriptionStatusLabel = ({
  className,
  subscription,
}: {
  className?: string
  subscription: schemas['Subscription'] | schemas['CustomerSubscription']
}) => {
  const label = getSubscriptionStatusLabel(subscription)

  return (
    <div className={twMerge('flex flex-row items-center gap-x-2', className)}>
      <StatusIcon
        {...getSubscriptionStatusIcon(
          subscription.status,
          subscription.cancel_at_period_end || subscription.pause_at_period_end,
        )}
      />
      <span>{label}</span>
    </div>
  )
}
