'use client'

import { EmptyState } from '@/components/Shared/EmptyState'
import {
  Toplist,
  ToplistItem,
  ToplistSkeleton,
  ToplistText,
  ToplistValue,
} from '@/components/Shared/Toplist'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, Avatar } from '@polar-sh/orbit'
import { ShieldCheck } from 'lucide-react'
import { cancelDate, useAtRisk } from './useAtRisk'

interface AtRiskListProps {
  organization: schemas['Organization']
}

export const AtRiskList = ({ organization }: AtRiskListProps) => {
  const {
    items: atRisk,
    isLoading,
    isError,
    refetch,
  } = useAtRisk(organization, 5)

  if (isLoading) {
    return <ToplistSkeleton rows={3} />
  }

  if (isError) {
    return (
      <Alert
        variant="danger"
        title="Could not load at-risk subscriptions"
        actions={[{ text: 'Retry', onClick: refetch }]}
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
