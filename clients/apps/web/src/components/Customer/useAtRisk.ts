import { useSubscriptions } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'

export type RiskReason = 'past_due' | 'canceling'

export interface AtRiskItem {
  subscription: schemas['Subscription']
  reason: RiskReason
}

export const cancelDate = (subscription: schemas['Subscription']) =>
  new Date(
    subscription.ends_at ?? subscription.current_period_end,
  ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export const useAtRisk = (
  organization: schemas['Organization'],
  limit: number,
) => {
  const {
    data: pastDue,
    isLoading: pastDueLoading,
    isError: pastDueError,
    refetch: refetchPastDue,
  } = useSubscriptions(organization.id, {
    status: ['past_due'],
    limit,
    sorting: ['-amount'],
  })
  const {
    data: canceling,
    isLoading: cancelingLoading,
    isError: cancelingError,
    refetch: refetchCanceling,
  } = useSubscriptions(organization.id, {
    status: ['active', 'trialing'],
    cancel_at_period_end: true,
    limit,
    sorting: ['current_period_end'],
  })

  const items = useMemo<AtRiskItem[]>(() => {
    const pastDueItems = (pastDue?.items ?? []).map((subscription) => ({
      subscription,
      reason: 'past_due' as const,
    }))
    const pastDueIds = new Set(pastDueItems.map((item) => item.subscription.id))
    const cancelingItems = (canceling?.items ?? [])
      .filter((subscription) => !pastDueIds.has(subscription.id))
      .map((subscription) => ({
        subscription,
        reason: 'canceling' as const,
      }))
    return [...pastDueItems, ...cancelingItems].slice(0, limit)
  }, [pastDue, canceling, limit])

  return {
    items,
    isLoading: pastDueLoading || cancelingLoading,
    isError: pastDueError || cancelingError,
    refetch: () => Promise.all([refetchPastDue(), refetchCanceling()]),
  }
}
