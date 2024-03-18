import {
  SubscriptionTier,
  SubscriptionTierPriceRecurringInterval,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import {
  getRecurringBillingLabel,
  getSubscriptionTierAudience,
  getSubscriptionTierPrice,
} from 'polarkit/subscriptions'
import { useMemo, useState } from 'react'

export const useRecurringInterval = () => {
  return useState<SubscriptionTierPriceRecurringInterval>(
    SubscriptionTierPriceRecurringInterval.MONTH,
  )
}

export const useSubscriptionTierPrice = (
  subscriptionTier: Partial<SubscriptionTier>,
  recurringInterval: SubscriptionTierPriceRecurringInterval,
) => {
  return useMemo(
    () => getSubscriptionTierPrice(subscriptionTier, recurringInterval),
    [subscriptionTier, recurringInterval],
  )
}

export const useRecurringBillingLabel = (
  recurringInterval: SubscriptionTierPriceRecurringInterval,
) => {
  return useMemo(
    () => getRecurringBillingLabel(recurringInterval),
    [recurringInterval],
  )
}

export const useSubscriptionTierAudience = (type?: SubscriptionTierType) => {
  return useMemo(() => getSubscriptionTierAudience(type), [type])
}
