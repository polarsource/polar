import { Organization, SubscriptionTier } from '@polar-sh/sdk'
import { useUser, useUserSubscriptions } from 'polarkit/hooks'

export interface SubscriptionCardAction {
  label: string
  link: string
  variant: 'primary' | 'secondary'
}

export const useSubscriptionCardAction = (
  subscriptionTier: SubscriptionTier,
  organization: Organization,
  subscribePath: string,
): SubscriptionCardAction => {
  const user = useUser()
  const userSubscriptions = useUserSubscriptions(
    user.data?.id ?? '',
    organization.name,
  )

  const userIsSubscribedToTier = userSubscriptions.data?.items?.some(
    (tier) => tier.id === subscriptionTier.id,
  )

  if (userIsSubscribedToTier) {
    return {
      label: 'Subscribed',
      link: '/backer/settings',
      variant: 'secondary',
    }
  } else {
    return {
      label: 'Subscribe',
      link: `${subscribePath}?tier=${subscriptionTier.id}`,
      variant: 'primary',
    }
  }
}
