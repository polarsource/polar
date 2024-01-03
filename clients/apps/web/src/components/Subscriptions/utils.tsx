import { CheckOutlined, ShortTextOutlined } from '@mui/icons-material'
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
      return '#9d4cff' as const
    case SubscriptionTierType.PRO:
      return '#29dea5' as const
    case SubscriptionTierType.HOBBY:
      return '#fb7e5d' as const
    case SubscriptionTierType.FREE:
    default:
      return '#3381FF' as const
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
  fontSize: 'small' | 'inherit' | 'large' | 'medium' = 'small',
) => {
  const className = twMerge('h-4 w-4')

  if (benefit.type === SubscriptionBenefitType.ARTICLES) {
    return <ShortTextOutlined className={className} fontSize={fontSize} />
  } else {
    return <CheckOutlined className={className} fontSize={fontSize} />
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
