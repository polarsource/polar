import {
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionTierPriceRecurringInterval,
  SubscriptionTierType,
} from '@polar-sh/sdk'

export const getSubscriptionColorByType = (
  type?: SubscriptionTierType,
): string => {
  switch (type) {
    case SubscriptionTierType.BUSINESS:
      return '#9d4cff' as const
    case SubscriptionTierType.INDIVIDUAL:
      return '#1fd39a' as const
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

export const hasRecurringInterval =
  (
    recurringInterval: SubscriptionTierPriceRecurringInterval,
    hideFree: boolean = false,
  ) =>
  (subscriptionTier: SubscriptionTier) => {
    if (subscriptionTier.type === SubscriptionTierType.FREE) {
      return !hideFree
    }
    return subscriptionTier.prices?.some(
      (price) => price.recurring_interval === recurringInterval,
    )
  }

export const getSubscriptionTierPrice = (
  subscriptionTier: Partial<SubscriptionTier>,
  recurringInterval: SubscriptionTierPriceRecurringInterval,
) => {
  let price = subscriptionTier.prices?.find(
    (price) => price.recurring_interval === recurringInterval,
  )
  if (!price) {
    if (subscriptionTier.prices && subscriptionTier.prices?.length > 0) {
      price = subscriptionTier.prices[0]
    } else {
      return {
        price_amount: 0,
        price_currency: 'usd',
        recurring_interval: SubscriptionTierPriceRecurringInterval.MONTH,
      }
    }
  }
  return price
}

export const getRecurringBillingLabel = (
  recurringInterval: SubscriptionTierPriceRecurringInterval,
) => {
  switch (recurringInterval) {
    case SubscriptionTierPriceRecurringInterval.MONTH:
      return '/mo'
    case SubscriptionTierPriceRecurringInterval.YEAR:
      return '/year'
  }
}

export const getSubscriptionTierAudience = (type?: SubscriptionTierType) => {
  switch (type) {
    case SubscriptionTierType.FREE:
      return 'For Anyone'
    case SubscriptionTierType.INDIVIDUAL:
      return 'For Individuals'
    case SubscriptionTierType.BUSINESS:
      return 'For Businesses'
  }
}
