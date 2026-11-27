import { StatusLabel } from '@/components/Shared/StatusIcon'
import { getSubscriptionStatusIcon } from '@/components/Subscriptions/SubscriptionStatusIcon'
import {
  getSubscriptionStatusLabel,
  isSubscriptionWindingDown,
} from '@/components/Subscriptions/utils'
import { schemas } from '@polar-sh/client'

export const SubscriptionStatusPill = ({
  subscription,
}: {
  subscription: schemas['CustomerSubscription']
}) => (
  <StatusLabel
    {...getSubscriptionStatusIcon(
      subscription.status,
      isSubscriptionWindingDown(subscription),
    )}
    label={getSubscriptionStatusLabel(subscription)}
  />
)
