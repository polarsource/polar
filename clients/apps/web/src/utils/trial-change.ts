'use client'

import { UTCDate } from '@date-fns/utc'
import { schemas } from '@polar-sh/client'
import { addDays, addMonths, addWeeks, addYears } from 'date-fns'
import { useMemo, useState } from 'react'

type TrialConfig = {
  trial_interval: schemas['TrialInterval'] | null
  trial_interval_count: number | null
}

type TrialSubscriptionLike = {
  status: schemas['SubscriptionStatus']
  trial_start: string | null
  product: { id: string }
}

type TrialProductLike = TrialConfig & { id: string }

export type TrialChangeOutcome =
  | { kind: 'continues'; trialEnd: Date }
  | { kind: 'ends' }
  | null

export const computeTrialEnd = (
  trialStart: string,
  product: TrialConfig,
): Date | null => {
  if (!product.trial_interval || !product.trial_interval_count) return null
  // UTCDate keeps date-fns arithmetic in UTC, matching the backend's
  // `dateutil.relativedelta` semantics (e.g. Jan 31 + 1 month → Feb 28/29).
  const start = new UTCDate(trialStart)
  const count = product.trial_interval_count
  switch (product.trial_interval) {
    case 'day':
      return addDays(start, count)
    case 'week':
      return addWeeks(start, count)
    case 'month':
      return addMonths(start, count)
    case 'year':
      return addYears(start, count)
  }
}

export const formatTrialEnd = (date: Date): string =>
  date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year:
      date.getUTCFullYear() === new Date().getUTCFullYear()
        ? undefined
        : 'numeric',
  })

/**
 * When changing the product on a trialing subscription, determine whether the
 * trial continues with the new product (recomputed against the original
 * trial_start) or ends immediately, triggering a charge.
 */
export const useTrialChangeOutcome = (
  subscription: TrialSubscriptionLike,
  selectedProduct: TrialProductLike | null | undefined,
): TrialChangeOutcome => {
  // Capture once when the hook mounts — trials don't expire mid-session, and
  // pinning `now` keeps the memo pure.
  const [now] = useState(() => Date.now())

  return useMemo<TrialChangeOutcome>(() => {
    if (subscription.status !== 'trialing') return null
    if (!selectedProduct || selectedProduct.id === subscription.product.id)
      return null
    if (!subscription.trial_start) return null

    const newTrialEnd = computeTrialEnd(
      subscription.trial_start,
      selectedProduct,
    )
    if (newTrialEnd && newTrialEnd.getTime() > now) {
      return { kind: 'continues', trialEnd: newTrialEnd }
    }
    return { kind: 'ends' }
  }, [subscription, selectedProduct, now])
}
