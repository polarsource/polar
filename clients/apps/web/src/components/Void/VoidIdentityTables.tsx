'use client'

import { formatRelativeTime } from '@/components/Timeline/TimelineItem'
import { formatHumanFriendlyScalar } from '@/utils/formatters'
import { DataTable, DataTableColumnDef, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { shortDate } from './identities'
import { VoidEntitlement, VoidEvent, VoidSubscription } from './types'

export const TableSection = ({
  title,
  caption,
  children,
}: {
  title: string
  caption?: string
  children: ReactNode
}) => (
  <Box flexDirection="column" rowGap="l">
    <Box alignItems="baseline" columnGap="m">
      <Text variant="heading-xxs" as="h3">
        {title}
      </Text>
      {caption ? (
        <Text color="muted" variant="caption">
          {caption}
        </Text>
      ) : null}
    </Box>
    {children}
  </Box>
)

const STATUS_COLOR: Record<
  VoidSubscription['status'],
  'green' | 'red' | 'blue'
> = { active: 'green', canceled: 'red', trialing: 'blue' }

const subscriptionColumns: DataTableColumnDef<VoidSubscription>[] = [
  {
    accessorKey: 'product',
    enableSorting: false,
    header: 'Product',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    accessorKey: 'status',
    enableSorting: false,
    header: 'Status',
    cell: ({ row: { original } }) => (
      <Status
        status={original.status}
        color={STATUS_COLOR[original.status]}
        size="small"
      />
    ),
  },
  {
    accessorKey: 'started_at',
    enableSorting: false,
    header: 'Since',
    cell: ({ getValue }) => shortDate(getValue() as string),
  },
  {
    id: 'period',
    enableSorting: false,
    header: 'Period',
    cell: ({ row: { original } }) => (
      <Text color="muted">
        {original.ends_at
          ? `Ends ${shortDate(original.ends_at)}`
          : `Renews ${shortDate(original.current_period_end)}`}
      </Text>
    ),
  },
]

const entitlementColumns = (
  identityId: string,
): DataTableColumnDef<VoidEntitlement>[] => [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Entitlement',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    accessorKey: 'product',
    enableSorting: false,
    header: 'Via',
    cell: ({ row: { original } }) => (
      <Text color="muted">
        {original.product}
        {original.identity_id !== identityId ? ' (inherited)' : ''}
      </Text>
    ),
  },
]

interface MeterRow {
  name: string
  units: number
}

const meterColumns: DataTableColumnDef<MeterRow>[] = [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Meter',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    accessorKey: 'units',
    enableSorting: false,
    header: 'Units / 30d',
    cell: ({ getValue }) => formatHumanFriendlyScalar(getValue() as number),
  },
]

const eventColumns: DataTableColumnDef<VoidEvent>[] = [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Event',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    accessorKey: 'source',
    enableSorting: false,
    header: 'Source',
    cell: ({ getValue }) => <Text color="muted">{getValue() as string}</Text>,
  },
  {
    accessorKey: 'timestamp',
    enableSorting: false,
    header: 'When',
    cell: ({ getValue }) => (
      <Text color="muted">{formatRelativeTime(getValue() as string)}</Text>
    ),
  },
]

export const SubscriptionsTable = ({ rows }: { rows: VoidSubscription[] }) =>
  rows.length === 0 ? (
    <Text color="muted">
      None. A parent may still hold one, see entitlements.
    </Text>
  ) : (
    <DataTable columns={subscriptionColumns} data={rows} isLoading={false} />
  )

export const EntitlementsTable = ({
  rows,
  identityId,
}: {
  rows: VoidEntitlement[]
  identityId: string
}) =>
  rows.length === 0 ? (
    <Text color="muted">None held through this identity or its ancestors.</Text>
  ) : (
    <DataTable
      columns={entitlementColumns(identityId)}
      data={rows}
      isLoading={false}
      getRowId={(row) => `${row.slug}:${row.subscription_id}`}
    />
  )

export const MetersTable = ({ meters }: { meters: Record<string, number> }) => (
  <DataTable
    columns={meterColumns}
    data={Object.entries(meters).map(([name, units]) => ({ name, units }))}
    isLoading={false}
    getRowId={(row) => row.name}
  />
)

export const EventsTable = ({ rows }: { rows: VoidEvent[] }) =>
  rows.length === 0 ? (
    <Text color="muted">No events recorded for this identity.</Text>
  ) : (
    <DataTable columns={eventColumns} data={rows} isLoading={false} />
  )
