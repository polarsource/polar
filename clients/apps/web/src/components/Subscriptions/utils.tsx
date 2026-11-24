import { StatusIcon, StatusTooltip } from '@/components/Shared/StatusIcon'
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

const subscriptionStatusDescriptions: {
  [key in schemas['SubscriptionStatus']]: string
} = {
  incomplete: 'The first payment has not been completed.',
  incomplete_expired: 'The first payment was not completed in time.',
  trialing: 'In a trial. The first charge is made when the trial ends.',
  active: 'Running, and renewed automatically each billing period.',
  past_due: 'A renewal payment failed. Polar is retrying it automatically.',
  paused:
    'Paused. Benefits are revoked and nothing is charged until it resumes.',
  trial_ended:
    'The trial ended without a payment method, so it did not convert.',
  canceled: 'Ended. Benefits are revoked.',
  unpaid: 'Ended because its payment could not be collected.',
}

const isRunning = (status: schemas['SubscriptionStatus']) =>
  status === 'active' || status === 'trialing'

// A subscription that is still running but set to end or pause.
export const isSubscriptionWindingDown = ({
  status,
  ends_at: endsAt,
  pause_at_period_end: pausesAtPeriodEnd,
}: Pick<
  schemas['Subscription'],
  'status' | 'ends_at' | 'pause_at_period_end'
>): boolean => isRunning(status) && (endsAt !== null || pausesAtPeriodEnd)

// A subscription that is winding down is named for what is about to happen
// to it.
export const getScheduledStatusLabel = (
  status: schemas['SubscriptionStatus'],
  { isCanceling = false, isPausing = false },
): string => {
  if (isRunning(status)) {
    if (isCanceling) return 'Canceling'
    if (isPausing) return 'Pausing'
  }
  return subscriptionStatusDisplayNames[status]
}

export const getScheduledStatusDescription = (
  status: schemas['SubscriptionStatus'],
  { isCanceling = false, isPausing = false },
): string => {
  if (isRunning(status)) {
    if (isCanceling) return 'Running until the end of the period, then it ends.'
    if (isPausing) return 'Running until the end of the period, then it pauses.'
  }
  return subscriptionStatusDescriptions[status]
}

export const getSubscriptionStatusDescription = ({
  status,
  ends_at: endsAt,
  pause_at_period_end: pausesAtPeriodEnd,
}: Pick<
  schemas['Subscription'],
  'status' | 'ends_at' | 'pause_at_period_end'
>): string =>
  getScheduledStatusDescription(status, {
    isCanceling: endsAt !== null,
    isPausing: pausesAtPeriodEnd,
  })

export const getSubscriptionStatusLabel = ({
  status,
  ends_at: endsAt,
  pause_at_period_end: pausesAtPeriodEnd,
}: Pick<
  schemas['Subscription'],
  'status' | 'ends_at' | 'pause_at_period_end'
>): string =>
  getScheduledStatusLabel(status, {
    isCanceling: endsAt !== null,
    isPausing: pausesAtPeriodEnd,
  })

export const SubscriptionStatusLabel = ({
  className,
  subscription,
}: {
  className?: string
  subscription: schemas['Subscription'] | schemas['CustomerSubscription']
}) => {
  const label = getSubscriptionStatusLabel(subscription)

  return (
    <StatusTooltip description={getSubscriptionStatusDescription(subscription)}>
      <div className={twMerge('flex flex-row items-center gap-x-2', className)}>
        <StatusIcon
          {...getSubscriptionStatusIcon(
            subscription.status,
            subscription.cancel_at_period_end ||
              subscription.pause_at_period_end,
          )}
        />
        <span>{label}</span>
      </div>
    </StatusTooltip>
  )
}
