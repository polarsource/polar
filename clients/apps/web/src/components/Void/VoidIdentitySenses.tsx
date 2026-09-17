'use client'

import { DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export interface VoidSenseRow {
  slug: string
  when: string
  over: string
  noul: number
  span_count: number
}

const percent = (value: number) =>
  `${Math.round(value * 100).toLocaleString('en-US')}%`

const columns: DataTableColumnDef<VoidSenseRow>[] = [
  {
    accessorKey: 'slug',
    enableSorting: false,
    header: 'Sense',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    accessorKey: 'noul',
    enableSorting: false,
    header: 'Noul',
    cell: ({ getValue }) => (
      <Text color="muted">{percent(getValue() as number)}</Text>
    ),
  },
  {
    accessorKey: 'over',
    enableSorting: false,
    header: 'Over',
    cell: ({ getValue }) => <Text color="muted">{getValue() as string}</Text>,
  },
  {
    accessorKey: 'span_count',
    enableSorting: false,
    header: 'Spans',
    cell: ({ getValue }) => (
      <Text color="muted">
        {(getValue() as number).toLocaleString('en-US')}
      </Text>
    ),
  },
  {
    accessorKey: 'when',
    enableSorting: false,
    header: 'When',
    cell: ({ getValue }) => <Text color="muted">{getValue() as string}</Text>,
  },
]

export const VoidIdentitySenses = ({ rows }: { rows: VoidSenseRow[] }) => (
  <Box flexDirection="column" rowGap="l">
    <Box alignItems="baseline" columnGap="m">
      <Text variant="heading-xxs" as="h3">
        Senses
      </Text>
      <Text color="muted" variant="caption">
        Stored noul over labeled spend. Thresholds stay in the SDK.
      </Text>
    </Box>
    <DataTable
      columns={columns}
      data={rows}
      isLoading={false}
      getRowId={(row) => row.slug}
    />
  </Box>
)
