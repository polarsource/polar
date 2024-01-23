import {
  CheckOutlined,
  ShortTextOutlined,
  WebOutlined,
} from '@mui/icons-material'
import {
  BenefitsInner,
  ItemsInner,
  SubscriptionBenefitType,
  SubscriptionStatus,
  SubscriptionTier,
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
    case SubscriptionTierType.INDIVIDUAL:
      return '#29dea5' as const
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
  [SubscriptionTierType.INDIVIDUAL]: [],
  [SubscriptionTierType.BUSINESS]: [],
}

export const tiersTypeDisplayNames: {
  [key in SubscriptionTierType]: string
} = {
  [SubscriptionTierType.FREE]: 'Free',
  [SubscriptionTierType.INDIVIDUAL]: 'Individual',
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
  benefit?: BenefitsInner,
  fontSize: 'small' | 'inherit' | 'large' | 'medium' = 'small',
) => {
  const className = twMerge('h-4 w-4')

  if (benefit && benefit.type === SubscriptionBenefitType.ARTICLES) {
    return <ShortTextOutlined className={className} fontSize={fontSize} />
  } else if (benefit && benefit.type === SubscriptionBenefitType.ADS) {
    return <WebOutlined className={className} fontSize={fontSize} />
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
