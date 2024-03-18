import {
  SubscriptionTier,
  SubscriptionTierPriceRecurringInterval,
  SubscriptionTierType,
} from '@polar-sh/sdk'

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

  const priceAmount =
    price.recurring_interval === SubscriptionTierPriceRecurringInterval.YEAR
      ? price.price_amount / 12
      : price.price_amount

  return {
    price_amount: priceAmount || 0,
    price_currency: price.price_currency,
    recurring_interval: price.recurring_interval,
  }
}

export const getRecurringBillingLabel = (
  recurringInterval: SubscriptionTierPriceRecurringInterval,
) => {
  switch (recurringInterval) {
    case SubscriptionTierPriceRecurringInterval.MONTH:
      return 'billed monthly'
    case SubscriptionTierPriceRecurringInterval.YEAR:
      return 'billed yearly'
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
