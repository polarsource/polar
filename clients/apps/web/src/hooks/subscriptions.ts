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
import { Dispatch, SetStateAction, useMemo, useState } from 'react'

export const useRecurringInterval = (
  tiers: SubscriptionTier[],
): [
  SubscriptionTierPriceRecurringInterval,
  Dispatch<SetStateAction<SubscriptionTierPriceRecurringInterval>>,
  boolean,
] => {
  const hasMonthInterval = useMemo(() => {
    return tiers.some((tier) =>
      tier.prices.some(
        (price) =>
          price.recurring_interval ===
          SubscriptionTierPriceRecurringInterval.MONTH,
      ),
    )
  }, [tiers])
  const hasYearInterval = useMemo(() => {
    return tiers.some((tier) =>
      tier.prices.some(
        (price) =>
          price.recurring_interval ===
          SubscriptionTierPriceRecurringInterval.YEAR,
      ),
    )
  }, [tiers])
  const hasBothIntervals = useMemo(
    () => hasMonthInterval && hasYearInterval,
    [hasMonthInterval, hasYearInterval],
  )

  const [recurringInterval, setRecurringInterval] =
    useState<SubscriptionTierPriceRecurringInterval>(
      hasBothIntervals
        ? SubscriptionTierPriceRecurringInterval.MONTH
        : hasYearInterval
          ? SubscriptionTierPriceRecurringInterval.YEAR
          : SubscriptionTierPriceRecurringInterval.MONTH,
    )

  return [recurringInterval, setRecurringInterval, hasBothIntervals]
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
