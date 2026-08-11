'use client'

import { EmptyState } from '@/components/Shared/EmptyState'
import {
  Toplist,
  ToplistItem,
  ToplistSkeleton,
  ToplistText,
  ToplistValue,
} from '@/components/Shared/Toplist'
import { useSubscriptions } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, Avatar } from '@polar-sh/orbit'
import { ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'

type RiskReason = 'past_due' | 'canceling'

interface AtRiskItem {
  subscription: schemas['Subscription']
  reason: RiskReason
}

const cancelDate = (subscription: schemas['Subscription']) =>
  new Date(
    subscription.ends_at ?? subscription.current_period_end,
  ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

interface AtRiskListProps {
  organization: schemas['Organization']
}

export const AtRiskList = ({ organization }: AtRiskListProps) => {
  const {
    data: pastDue,
    isLoading: pastDueLoading,
    isError: pastDueError,
    refetch: refetchPastDue,
  } = useSubscriptions(organization.id, {
    status: ['past_due'],
    limit: 10,
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
    limit: 10,
    sorting: ['current_period_end'],
  })

  const atRisk = useMemo<AtRiskItem[]>(() => {
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
    return [...pastDueItems, ...cancelingItems].slice(0, 5)
  }, [pastDue, canceling])

  if (pastDueLoading || cancelingLoading) {
    return <ToplistSkeleton rows={3} />
  }

  if (pastDueError || cancelingError) {
    return (
      <Alert
        variant="danger"
        title="Could not load at-risk subscriptions"
        actions={[
          {
            text: 'Retry',
            onClick: () => {
              refetchPastDue()
              refetchCanceling()
            },
          },
        ]}
      />
    )
  }

  if (atRisk.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck />}
        title="Nothing at risk"
        description="No payment issues or scheduled cancellations."
        fill
      />
    )
  }

  return (
    <Toplist>
      {atRisk.map(({ subscription, reason }) => (
        <ToplistItem
          key={subscription.id}
          href={`/dashboard/${organization.slug}/customers/${subscription.customer_id}`}
        >
          <Avatar
            className="h-8 w-8"
            avatar_url={subscription.customer.avatar_url}
            name={
              subscription.customer.name ?? subscription.customer.email ?? '-'
            }
          />
          <ToplistText
            primary={
              subscription.customer.name ?? subscription.customer.email ?? '-'
            }
            secondary={subscription.product.name}
          />
          <ToplistValue
            value={formatCurrency('statistics')(
              subscription.amount,
              subscription.currency,
            )}
            caption={
              reason === 'past_due'
                ? 'Past due'
                : `Cancels ${cancelDate(subscription)}`
            }
            captionColor={reason === 'past_due' ? 'danger' : 'warning'}
          />
        </ToplistItem>
      ))}
    </Toplist>
  )
}
