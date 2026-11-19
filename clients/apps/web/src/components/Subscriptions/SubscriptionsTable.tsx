'use client'

import {
  CondensedTable,
  CondensedTableHeader,
  CondensedTableSkeleton,
  type CondensedTableColumn,
} from '@/components/Shared/CondensedTable'
import { useInViewport } from '@/hooks/utils'
import { schemas } from '@polar-sh/client'
import { Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { format } from 'date-fns'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { formatSubscriptionPrice } from './Gantt/GanttRowLabel'
import {
  getSubscriptionStatusBorderColor,
  subscriptionStatusDisplayNames,
} from './utils'

type Subscription = schemas['Subscription']

const formatDate = (date: string) => format(new Date(date), 'MMM d, yyyy')

const getCustomerLabel = ({ customer }: Subscription) =>
  customer.name || customer.email || '—'

const getNextStep = (subscription: Subscription): string => {
  const { status, current_period_end: periodEnd } = subscription
  if (subscription.ended_at) return `Ended ${formatDate(subscription.ended_at)}`
  if (subscription.ends_at) return `Ends ${formatDate(subscription.ends_at)}`
  if (status === 'paused') {
    return subscription.resumes_at
      ? `Resumes ${formatDate(subscription.resumes_at)}`
      : '—'
  }
  if (subscription.pause_at_period_end) return `Pauses ${formatDate(periodEnd)}`
  if (status === 'trialing') return `Trial ends ${formatDate(periodEnd)}`
  return `Renews ${formatDate(periodEnd)}`
}

const StatusCell = ({ subscription }: { subscription: Subscription }) => (
  <>
    <span
      className={twMerge(
        'size-2 shrink-0 rounded-full border-2',
        getSubscriptionStatusBorderColor(
          subscription.status,
          subscription.ends_at !== null || subscription.pause_at_period_end,
        ),
      )}
    />
    <Text truncate>{subscriptionStatusDisplayNames[subscription.status]}</Text>
  </>
)

const columns: CondensedTableColumn<Subscription>[] = [
  {
    key: 'customer',
    header: 'Customer',
    grow: 2,
    minWidth: 120,
    skeleton: [140, 180, 120, 200, 160, 110, 190, 150, 130, 170],
    cell: (subscription) => (
      <Text truncate>{getCustomerLabel(subscription)}</Text>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: 104,
    skeleton: [64, 56, 72],
    cell: (subscription) => <StatusCell subscription={subscription} />,
  },
  {
    key: 'product',
    header: 'Product',
    skeleton: [90, 70, 100, 80, 60],
    cell: (subscription) => (
      <Text color="muted" truncate>
        {subscription.product.name}
      </Text>
    ),
  },
  {
    key: 'discount',
    header: 'Discount',
    cell: (subscription) => (
      <Text color="muted" truncate>
        {subscription.discount?.name ?? ''}
      </Text>
    ),
  },
  {
    key: 'started',
    header: 'Started',
    width: 96,
    skeleton: [80],
    cell: (subscription) => (
      <Text color="muted" tabularNums wrap="nowrap">
        {subscription.started_at ? formatDate(subscription.started_at) : '—'}
      </Text>
    ),
  },
  {
    key: 'next',
    header: 'Next',
    width: 168,
    skeleton: [130, 110, 140],
    cell: (subscription) => (
      <Text color="muted" tabularNums truncate>
        {getNextStep(subscription)}
      </Text>
    ),
  },
  {
    key: 'price',
    header: 'Price',
    width: 112,
    align: 'end',
    skeleton: [72, 64, 80],
    cell: (subscription) => (
      <Text tabularNums wrap="nowrap">
        {formatSubscriptionPrice(subscription)}
      </Text>
    ),
  },
]

const CompactRow = ({ subscription }: { subscription: Subscription }) => (
  <>
    <Box alignItems="center" justifyContent="between" gap="m">
      <Box minWidth={0}>
        <Text truncate>{getCustomerLabel(subscription)}</Text>
      </Box>
      <Box flexShrink={0}>
        <Text tabularNums>{formatSubscriptionPrice(subscription)}</Text>
      </Box>
    </Box>
    <Text variant="caption" color="muted" truncate>
      {subscription.product.name} ·{' '}
      {subscriptionStatusDisplayNames[subscription.status]} ·{' '}
      {getNextStep(subscription)}
    </Text>
  </>
)

interface SubscriptionsTableProps {
  subscriptions: Subscription[] | undefined
  selectedId: string | null
  onSelect: (id: string | null) => void
  isLoadingMore: boolean
  onEndReached: () => void
}

export const SubscriptionsTable = ({
  subscriptions,
  selectedId,
  onSelect,
  isLoadingMore,
  onEndReached,
}: SubscriptionsTableProps) => {
  const { ref: endRef, inViewport: isEndVisible } =
    useInViewport<HTMLDivElement>()
  useEffect(() => {
    if (isEndVisible && !isLoadingMore) {
      onEndReached()
    }
  }, [isEndVisible, isLoadingMore, onEndReached])

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0}>
      <CondensedTableHeader columns={columns} inset="l" compact />
      <Box flexDirection="column" flexGrow={1} minHeight={0} overflowY="auto">
        {subscriptions === undefined ? (
          <CondensedTableSkeleton columns={columns} inset="l" compact />
        ) : subscriptions.length === 0 ? (
          <Box px="l" py="l">
            <Text color="muted">No subscriptions found</Text>
          </Box>
        ) : (
          <CondensedTable
            columns={columns}
            rows={subscriptions}
            getRowId={(subscription) => subscription.id}
            selectedId={selectedId}
            onSelect={onSelect}
            onClose={() => onSelect(null)}
            renderCompact={(subscription) => (
              <CompactRow subscription={subscription} />
            )}
            inset="l"
          />
        )}
        <div ref={endRef} />
        {isLoadingMore && (
          <Box justifyContent="center" paddingVertical="l">
            <Spinner />
          </Box>
        )}
      </Box>
    </Box>
  )
}
