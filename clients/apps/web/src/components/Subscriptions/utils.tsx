import {
  Product,
  ProductPriceRecurringInterval,
  SubscriptionStatus,
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
    recurringInterval: ProductPriceRecurringInterval,
    hideFree: boolean = false,
  ) =>
  (subscriptionTier: Product) => {
    if (subscriptionTier.type === SubscriptionTierType.FREE) {
      return !hideFree
    }
    return subscriptionTier.prices?.some(
      (price) => price.recurring_interval === recurringInterval,
    )
  }

export const getSubscriptionTierPrice = (
  subscriptionTier: Partial<Product>,
  recurringInterval: ProductPriceRecurringInterval,
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
        recurring_interval: ProductPriceRecurringInterval.MONTH,
      }
    }
  }
  return price
}

export const getRecurringBillingLabel = (
  recurringInterval: ProductPriceRecurringInterval,
) => {
  switch (recurringInterval) {
    case ProductPriceRecurringInterval.MONTH:
      return '/mo'
    case ProductPriceRecurringInterval.YEAR:
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
