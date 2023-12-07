import {
  CheckOutlined,
  Face,
  GestureOutlined,
  LanguageOutlined,
  ScheduleOutlined,
} from '@mui/icons-material'
import {
  ItemsInner,
  SubscriptionBenefitType,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionTierBenefit,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { twMerge } from 'tailwind-merge'

export type SubscriptionBenefit = ItemsInner

export const getSubscriptionColorByType = (
  type?: SubscriptionTierType,
): string => {
  switch (type) {
    case SubscriptionTierType.BUSINESS:
      return '#e18f79' as const
    case SubscriptionTierType.PRO:
      return '#29dea5' as const
    case SubscriptionTierType.HOBBY:
      return '#79A2E1' as const
    case SubscriptionTierType.FREE:
    default:
      return '#8e44ad' as const
  }
}

export type SubscriptionTiersByType = {
  [key in SubscriptionTierType]: (SubscriptionTier & { type: key })[]
}

const defaultSubscriptionTiersByType: SubscriptionTiersByType = {
  [SubscriptionTierType.FREE]: [],
  [SubscriptionTierType.HOBBY]: [],
  [SubscriptionTierType.PRO]: [],
  [SubscriptionTierType.BUSINESS]: [],
}

export const tiersTypeDisplayNames: {
  [key in SubscriptionTierType]: string
} = {
  [SubscriptionTierType.FREE]: 'Free',
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

export const isPremiumArticlesBenefit = (
  benefit: SubscriptionBenefit,
): boolean =>
  benefit.type === SubscriptionBenefitType.ARTICLES &&
  benefit.properties.paid_articles === true
