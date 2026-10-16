import {
  getSubscriptionStatusColor,
  subscriptionStatusDisplayNames,
} from '@/components/Subscriptions/utils'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/orbit'

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
    <Status
      size="small"
      status={label}
      color={getSubscriptionStatusColor(subscription.status, isEnding)}
    />
  )
}
