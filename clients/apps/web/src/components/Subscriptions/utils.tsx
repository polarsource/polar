import {
  Product,
  ProductPriceRecurring,
  ProductPriceType,
  SubscriptionRecurringInterval,
  SubscriptionStatus,
  SubscriptionTierType,
} from '@polar-sh/sdk'

export const getSubscriptionColorByType = (
  type: SubscriptionTierType,
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
  [key in SubscriptionTierType]: (Product & { type: key })[]
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

export const getSubscriptionTiersByType = (tiers: Product[]) =>
  tiers.reduce((acc: SubscriptionTiersByType, subscriptionTier: Product) => {
    if (!subscriptionTier.type) {
      return acc
    }

    const entry = [...acc[subscriptionTier.type], subscriptionTier]
    return {
      ...acc,
      [subscriptionTier.type]: entry,
    }
  }, defaultSubscriptionTiersByType) ?? defaultSubscriptionTiersByType

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
    recurringInterval: SubscriptionRecurringInterval,
    hideFree: boolean = false,
  ) =>
  (
    subscriptionTier: Product,
  ): subscriptionTier is Product & { type: SubscriptionTierType } => {
    if (subscriptionTier.type === SubscriptionTierType.FREE) {
      return !hideFree
    }
    return subscriptionTier.prices?.some(
      (price) =>
        price.type === ProductPriceType.RECURRING &&
        price.recurring_interval === recurringInterval,
    )
  }

export const getRecurringProductPrice = (
  subscriptionTier: Partial<Product>,
  recurringInterval: SubscriptionRecurringInterval,
): ProductPriceRecurring | undefined => {
  return subscriptionTier.prices?.find(
    (price) =>
      price.type === ProductPriceType.RECURRING &&
      price.recurring_interval === recurringInterval,
  ) as ProductPriceRecurring | undefined
}

export const getRecurringBillingLabel = (
  recurringInterval: SubscriptionRecurringInterval,
) => {
  switch (recurringInterval) {
    case SubscriptionRecurringInterval.MONTH:
      return '/mo'
    case SubscriptionRecurringInterval.YEAR:
      return '/year'
  }
}

export const getSubscriptionTierAudience = (type: SubscriptionTierType) => {
  switch (type) {
    case SubscriptionTierType.FREE:
      return 'For Anyone'
    case SubscriptionTierType.INDIVIDUAL:
      return 'For Individuals'
    case SubscriptionTierType.BUSINESS:
      return 'For Businesses'
  }
}
