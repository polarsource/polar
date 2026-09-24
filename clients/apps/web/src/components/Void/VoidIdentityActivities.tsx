'use client'

import { formatCurrency } from '@polar-sh/currency'
import { DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { VoidActivityMix, VoidActivityShare } from './types'
import { VoidSectionHeading } from './VoidShell'

const usd = (cents: number) => formatCurrency('statistics')(cents, 'usd')

const percent = (value: number) =>
  `${Math.round(value * 100).toLocaleString('en-US')}%`

const formatCost = (value: number, asCurrency: boolean) =>
  asCurrency ? usd(value) : value.toLocaleString('en-US')

const columns = (
  asCurrency: boolean,
): DataTableColumnDef<VoidActivityShare>[] => [
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
    cell: ({ getValue }) => formatCost(getValue() as number, asCurrency),
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
      <Text color="muted">{formatCost(getValue() as number, asCurrency)}</Text>
    ),
  },
]

export const VoidIdentityActivities = ({
  mix,
  costAsCurrency = true,
}: {
  mix: VoidActivityMix
  costAsCurrency?: boolean
}) => (
  <Box flexDirection="column" rowGap="l">
    <VoidSectionHeading title="Activities" caption="Model calls by label" />
    <DataTable
      columns={columns(costAsCurrency)}
      data={mix.by_activity}
      isLoading={false}
      getRowId={(row) => row.slug}
    />
  </Box>
)
