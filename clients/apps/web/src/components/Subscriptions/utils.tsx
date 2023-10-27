import {
  CheckOutlined,
  FaceOutlined,
  GestureOutlined,
  LanguageOutlined,
  ScheduleOutlined,
} from '@mui/icons-material'
import {
  SubscriptionTier,
  SubscriptionTierBenefit,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { twMerge } from 'tailwind-merge'

export const getSubscriptionColorByType = (type?: SubscriptionTierType) => {
  switch (type) {
    case SubscriptionTierType.BUSINESS:
      return '#e18f79' as const
    case SubscriptionTierType.PRO:
      return '#9f74ff' as const
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

export const resolveBenefitIcon = (
  benefit: SubscriptionTierBenefit,
  checked: boolean,
) => {
  const description = benefit.description.toLowerCase()
  const className = twMerge('h-4 w-4', checked && 'text-white')

  if (description.includes('logo') || description.includes('logotype')) {
    return <GestureOutlined className={className} fontSize="small" />
  } else if (description.includes('hour')) {
    return <ScheduleOutlined className={className} fontSize="small" />
  } else if (description.includes('avatar')) {
    return <FaceOutlined className={className} fontSize="small" />
  } else if (description.includes('website')) {
    return <LanguageOutlined className={className} fontSize="small" />
  } else {
    return <CheckOutlined className={className} fontSize="small" />
  }
}
