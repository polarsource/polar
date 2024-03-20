import {
  SubscriptionTier,
  SubscriptionTierPriceRecurringInterval,
  SubscriptionTierType,
} from '@polar-sh/sdk'

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
