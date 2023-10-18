import { SubscriptionTierType } from '@polar-sh/sdk'

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
