import {
  ProductPriceRecurring,
  ProductPriceType,
  ProductStorefront,
  SubscriptionRecurringInterval,
  SubscriptionStatus,
} from '@polar-sh/sdk'

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
  (recurringInterval: SubscriptionRecurringInterval) =>
  (
    subscriptionTier: ProductStorefront,
  ): subscriptionTier is ProductStorefront & {
    prices: ProductPriceRecurring[]
  } => {
    return subscriptionTier.prices?.some(
      (price) =>
        price.type === ProductPriceType.RECURRING &&
        price.recurring_interval === recurringInterval,
    )
  }

export const getRecurringProductPrice = (
  subscriptionTier: Partial<ProductStorefront>,
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
