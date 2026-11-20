'use client'

import {
  CondensedTable,
  CondensedTableHeader,
  CondensedTableSkeleton,
  useCondensedTable,
  type CondensedTableColumn,
} from '@/components/Shared/CondensedTable'
import { type DataTableSortingState } from '@/utils/datatable'
import { useInViewport } from '@/hooks/utils'
import { schemas } from '@polar-sh/client'
import { Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type OnChangeFn } from '@tanstack/react-table'
import { format } from 'date-fns'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  formatSubscriptionPrice,
  getSubscriptionStatusBorderColor,
  subscriptionStatusDisplayNames,
} from './utils'

type Subscription = schemas['Subscription']

const FOOTER_HEIGHT = 44

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

const EMPTY: Subscription[] = []

// Each id is the key the list endpoint sorts by.
const columns: CondensedTableColumn<Subscription>[] = [
  {
    id: 'customer',
    accessorFn: getCustomerLabel,
    header: 'Customer',
    meta: {
      grow: 2,
      minWidth: 120,
      skeleton: [140, 180, 120, 200, 160, 110, 190, 150, 130, 170],
    },
    cell: ({ row }) => <Text truncate>{getCustomerLabel(row.original)}</Text>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { width: 104, skeleton: [64, 56, 72] },
    cell: ({ row }) => <StatusCell subscription={row.original} />,
  },
  {
    id: 'product',
    accessorFn: ({ product }) => product.name,
    header: 'Product',
    meta: { minWidth: 72, skeleton: [90, 70, 100, 80, 60] },
    cell: ({ row }) => (
      <Text color="muted" truncate>
        {row.original.product.name}
      </Text>
    ),
  },
  {
    id: 'discount',
    accessorFn: ({ discount }) => discount?.name ?? '',
    header: 'Discount',
    cell: ({ row }) => (
      <Text color="muted" truncate>
        {row.original.discount?.name ?? ''}
      </Text>
    ),
  },
  {
    accessorKey: 'started_at',
    header: 'Started',
    sortDescFirst: true,
    meta: { width: 96, skeleton: [80] },
    cell: ({ row: { original: subscription } }) => (
      <Text color="muted" tabularNums wrap="nowrap">
        {subscription.started_at ? formatDate(subscription.started_at) : '—'}
      </Text>
    ),
  },
  {
    accessorKey: 'current_period_end',
    header: 'Next',
    sortDescFirst: false,
    meta: { width: 152, skeleton: [130, 110, 140] },
    cell: ({ row }) => (
      <Text color="muted" tabularNums truncate>
        {getNextStep(row.original)}
      </Text>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Price',
    sortDescFirst: true,
    meta: { width: 112, align: 'end', skeleton: [72, 64, 80] },
    cell: ({ row }) => (
      <Text tabularNums wrap="nowrap">
        {formatSubscriptionPrice(row.original)}
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
  sorting: DataTableSortingState
  onSortingChange: OnChangeFn<DataTableSortingState>
  selectedId: string | null
  onSelect: (id: string | null) => void
  footerLabel?: string
  isLoadingMore: boolean
  onEndReached: () => void
}

export const SubscriptionsTable = ({
  subscriptions,
  sorting,
  onSortingChange,
  selectedId,
  onSelect,
  footerLabel,
  isLoadingMore,
  onEndReached,
}: SubscriptionsTableProps) => {
  const table = useCondensedTable({
    columns,
    rows: subscriptions ?? EMPTY,
    getRowId: (subscription) => subscription.id,
    sorting,
    onSortingChange,
  })
  const { ref: endRef, inViewport: isEndVisible } =
    useInViewport<HTMLDivElement>()
  useEffect(() => {
    if (isEndVisible && !isLoadingMore) {
      onEndReached()
    }
  }, [isEndVisible, isLoadingMore, onEndReached])

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0}>
      <CondensedTableHeader table={table} inset="l" compact />
      <Box flexDirection="column" flexGrow={1} minHeight={0} overflowY="auto">
        {subscriptions === undefined ? (
          <CondensedTableSkeleton table={table} inset="l" compact />
        ) : subscriptions.length === 0 ? (
          <Box px="l" py="l">
            <Text color="muted">No subscriptions found</Text>
          </Box>
        ) : (
          <CondensedTable
            table={table}
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
      <Box
        flexShrink={0}
        height={FOOTER_HEIGHT}
        alignItems="center"
        px="l"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {footerLabel && (
          <Text color="muted" truncate tabularNums>
            {footerLabel}
          </Text>
        )}
      </Box>
    </Box>
  )
}
