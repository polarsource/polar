'use client'

import { EmptyState } from '@/components/Shared/EmptyState'
import {
  Toplist,
  ToplistItem,
  ToplistSkeleton,
  ToplistText,
  ToplistValue,
} from '@/components/Shared/Toplist'
import { CustomerStatItem, useEventCustomerStats } from '@/hooks/queries/events'
import { toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, Avatar } from '@polar-sh/orbit'
import { Coins } from 'lucide-react'
import { useMemo } from 'react'

const cost = (stat: CustomerStatItem) =>
  parseFloat(String(stat.totals?.['_cost_amount'] ?? '0'))

interface TopCostCustomersListProps {
  organization: schemas['Organization']
  start: Date
  end: Date
}

export const TopCostCustomersList = ({
  organization,
  start,
  end,
}: TopCostCustomersListProps) => {
  const { data, isLoading, isError, refetch } = useEventCustomerStats(
    organization.id,
    {
      start_date: toISODate(start),
      end_date: toISODate(end),
      aggregate_fields: ['_cost.amount'],
      limit: 5,
    },
  )

  const stats = useMemo(
    () => (data?.items ?? []).filter((stat) => cost(stat) > 0).slice(0, 5),
    [data],
  )

  if (isLoading) {
    return <ToplistSkeleton rows={3} />
  }

  if (isError) {
    return (
      <Alert
        variant="danger"
        title="Could not load cost statistics"
        actions={[{ text: 'Retry', onClick: () => refetch() }]}
      />
    )
  }

  if (stats.length === 0) {
    return (
      <EmptyState
        icon={<Coins />}
        title="No cost data"
        description="Costs come from _cost metadata on ingested events."
        fill
      />
    )
  }

  return (
    <Toplist>
      {stats.map((stat) => (
        <ToplistItem
          key={stat.customer_id ?? stat.external_customer_id}
          href={
            stat.customer_id
              ? `/dashboard/${organization.slug}/customers/${stat.customer_id}`
              : undefined
          }
        >
          <Avatar
            className="h-8 w-8"
            avatar_url={null}
            name={stat.name ?? stat.email ?? stat.external_customer_id ?? '-'}
          />
          <ToplistText
            primary={
              stat.name ?? stat.email ?? stat.external_customer_id ?? '-'
            }
            secondary={`${stat.occurrences.toLocaleString()} ${
              stat.occurrences === 1 ? 'event' : 'events'
            }`}
          />
          <ToplistValue
            value={formatCurrency('subcent')(cost(stat), 'usd')}
            caption={`${Math.round(stat.share * 100)}% of costs`}
          />
        </ToplistItem>
      ))}
    </Toplist>
  )
}
