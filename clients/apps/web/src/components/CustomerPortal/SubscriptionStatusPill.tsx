import { StatusLabel } from '@/components/Shared/StatusIcon'
import { getSubscriptionStatusIcon } from '@/components/Subscriptions/SubscriptionStatusIcon'
import { subscriptionStatusDisplayNames } from '@/components/Subscriptions/utils'
import { schemas } from '@polar-sh/client'

export const SubscriptionStatusPill = ({
  subscription,
}: {
  subscription: schemas['CustomerSubscription']
}) => {
  const isEnding =
    subscription.status === 'active' &&
    (!!subscription.ends_at || subscription.pause_at_period_end)

  const label =
    subscription.status === 'active' && subscription.ends_at
      ? 'Ending'
      : subscription.status === 'active' && subscription.pause_at_period_end
        ? 'Pausing'
        : subscriptionStatusDisplayNames[subscription.status]

  return (
    <StatusLabel
      {...getSubscriptionStatusIcon(subscription.status, isEnding)}
      label={label}
    />
  )
}
