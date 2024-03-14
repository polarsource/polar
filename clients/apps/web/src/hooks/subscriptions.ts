import { SubscriptionTierPriceRecurringInterval } from '@polar-sh/sdk'
import { useState } from 'react'

export const useRecurringInterval = () => {
  return useState<SubscriptionTierPriceRecurringInterval>(
    SubscriptionTierPriceRecurringInterval.MONTH,
  )
}
