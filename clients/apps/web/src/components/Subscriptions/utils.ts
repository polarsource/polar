import { SubscriptionTier, SubscriptionTierType } from '@polar-sh/sdk'

export const getSubscriptionColorByType = (type?: SubscriptionTierType) => {
  switch (type) {
    case SubscriptionTierType.BUSINESS:
      return '#FFB174' as const
    case SubscriptionTierType.PRO:
      return '#1be39f' as const
    case SubscriptionTierType.HOBBY:
    default:
      return '#79A2E1' as const
  }
}

export type SubscriptionTiersByType = {
  [key in SubscriptionTierType]: SubscriptionTier[]
}

const defaultSubscriptionTiersByType: SubscriptionTiersByType = {
  [SubscriptionTierType.HOBBY]: [],
  [SubscriptionTierType.PRO]: [],
  [SubscriptionTierType.BUSINESS]: [],
}

export const getSubscriptionTiersByType = (tiers: SubscriptionTier[]) =>
  tiers.reduce(
    (acc: SubscriptionTiersByType, subscriptionTier: SubscriptionTier) => {
      const entry = [...acc[subscriptionTier.type], subscriptionTier]

      return {
        ...acc,
        [subscriptionTier.type]: entry,
      }
    },
    defaultSubscriptionTiersByType,
  ) ?? defaultSubscriptionTiersByType
