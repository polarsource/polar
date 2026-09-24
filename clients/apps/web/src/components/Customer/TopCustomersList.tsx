'use client'

import { EmptyState } from '@/components/Shared/EmptyState'
import {
  Toplist,
  ToplistItem,
  ToplistSkeleton,
  ToplistText,
  ToplistValue,
} from '@/components/Shared/Toplist'
import { useTopCustomers } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, Avatar } from '@polar-sh/orbit'
import { TrendingUp } from 'lucide-react'

interface TopCustomersListProps {
  organization: schemas['Organization']
  start: Date
  end: Date
}

export const TopCustomersList = ({
  organization,
  start,
  end,
}: TopCustomersListProps) => {
  const {
    data: topCustomers,
    isLoading,
    isError,
    refetch,
  } = useTopCustomers(organization.id, {
    start,
    end,
    limit: 5,
  })

  if (isLoading) {
    return <ToplistSkeleton rows={5} />
  }

  if (isError) {
    return (
      <Alert
        variant="danger"
        title="Could not load top customers"
        actions={[{ text: 'Retry', onClick: () => refetch() }]}
      />
    )
  }

  if (!topCustomers || topCustomers.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp />}
        title="No revenue yet"
        description="No paid orders were recorded in this period."
        fill
      />
    )
  }

  return (
    <Toplist>
      {topCustomers.map((customer) => (
        <ToplistItem
          key={customer.id}
          href={`/dashboard/${organization.slug}/customers/${customer.id}`}
        >
          <Avatar
            className="h-8 w-8"
            avatar_url={customer.avatar_url}
            name={customer.name ?? customer.email ?? '-'}
          />
          <ToplistText
            primary={customer.name ?? customer.email ?? '-'}
            secondary={
              customer.name && customer.email ? customer.email : undefined
            }
          />
          <ToplistValue
            value={formatCurrency('statistics')(customer.net_revenue, 'usd')}
            caption={`${customer.order_count} ${
              customer.order_count === 1 ? 'order' : 'orders'
            }`}
          />
        </ToplistItem>
      ))}
    </Toplist>
  )
}
