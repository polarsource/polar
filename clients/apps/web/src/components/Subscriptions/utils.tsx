import {
  CheckOutlined,
  Face,
  GestureOutlined,
  LanguageOutlined,
  ScheduleOutlined,
} from '@mui/icons-material'
import {
  SubscriptionStatus,
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

export const tiersTypeDisplayNames: {
  [key in SubscriptionTierType]: string
} = {
  [SubscriptionTierType.HOBBY]: 'Hobby',
  [SubscriptionTierType.PRO]: 'Pro',
  [SubscriptionTierType.BUSINESS]: 'Business',
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
    return <Face className={className} fontSize="small" />
  } else if (description.includes('website')) {
    return <LanguageOutlined className={className} fontSize="small" />
  } else {
    return <CheckOutlined className={className} fontSize="small" />
  }
}

export const subscriptionStatusDisplayNames: {
  [key in SubscriptionStatus]: string
} = {
  [SubscriptionStatus.INCOMPLETE]: 'Incomplete',
  [SubscriptionStatus.INCOMPLETE_EXPIRED]: 'Incomplete',
  [SubscriptionStatus.TRIALING]: 'Trialing',
  [SubscriptionStatus.ACTIVE]: 'Active',
  [SubscriptionStatus.PAST_DUE]: 'Past due',
  [SubscriptionStatus.CANCELED]: 'Canceled',
  [SubscriptionStatus.UNPAID]: 'Unpaid',
}
