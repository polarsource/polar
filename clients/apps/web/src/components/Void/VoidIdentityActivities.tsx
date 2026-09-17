'use client'

import { formatCurrency } from '@polar-sh/currency'
import { DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { VoidActivityMix, VoidActivityShare } from './types'

const usd = (cents: number) => formatCurrency('statistics')(cents, 'usd')

const percent = (value: number) =>
  `${Math.round(value * 100).toLocaleString('en-US')}%`

const columns: DataTableColumnDef<VoidActivityShare>[] = [
  {
    accessorKey: 'slug',
    enableSorting: false,
    header: 'Activity',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    accessorKey: 'share',
    enableSorting: false,
    header: 'Share',
    cell: ({ getValue }) => (
      <Text color="muted">{percent(getValue() as number)}</Text>
    ),
  },
  {
    accessorKey: 'cost',
    enableSorting: false,
    header: 'Cost',
    cell: ({ getValue }) => usd(getValue() as number),
  },
  {
    accessorKey: 'spans',
    enableSorting: false,
    header: 'Spans',
    cell: ({ getValue }) => (
      <Text color="muted">
        {(getValue() as number).toLocaleString('en-US')}
      </Text>
    ),
  },
  {
    accessorKey: 'waste_cost',
    enableSorting: false,
    header: 'Retry / waste',
    cell: ({ getValue }) => (
      <Text color="muted">{usd(getValue() as number)}</Text>
    ),
  },
]

export const VoidIdentityActivities = ({ mix }: { mix: VoidActivityMix }) => (
  <Box flexDirection="column" rowGap="l">
    <Box alignItems="baseline" columnGap="m">
      <Text variant="heading-xxs" as="h3">
        Activities
      </Text>
      <Text color="muted" variant="caption">
        How this identity spent model calls, labeled after ingest
      </Text>
    </Box>
    <DataTable
      columns={columns}
      data={mix.by_activity}
      isLoading={false}
      getRowId={(row) => row.slug}
    />
  </Box>
)
