'use client'

import {
  Avatar,
  DataTable,
  DataTableColumnDef,
  Status,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { Delta } from './Delta'
import { usd } from './format'
import { CustomerResult, ReplayResult } from './types'

const riskLabel = (risk: number) =>
  risk >= 0.5 ? 'High risk' : risk > 0 ? 'At risk' : null

const columns: DataTableColumnDef<CustomerResult>[] = [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Customer',
    cell: ({ row: { original } }) => (
      <Box alignItems="center" columnGap="m" minWidth={0}>
        <Avatar className="h-8 w-8" avatar_url={null} name={original.name} />
        <Box flexDirection="column" minWidth={0}>
          <Text truncate>{original.name}</Text>
          <Text truncate color="muted" variant="caption">
            {original.plan} · {usd(original.usage)} usage
          </Text>
        </Box>
      </Box>
    ),
  },
  {
    accessorKey: 'baseline',
    enableSorting: false,
    header: 'Baseline / 30d',
    cell: ({ getValue }) => usd(getValue() as number),
  },
  {
    accessorKey: 'scenario',
    enableSorting: false,
    header: 'Scenario / 30d',
    cell: ({ getValue }) => usd(getValue() as number),
  },
  {
    accessorKey: 'delta',
    enableSorting: false,
    header: 'Change',
    cell: ({ row: { original } }) => (
      <Delta delta={original.delta} ratio={original.deltaPct} />
    ),
  },
  {
    accessorKey: 'churnRisk',
    enableSorting: false,
    header: 'Reaction',
    cell: ({ row: { original } }) => {
      const label = riskLabel(original.churnRisk)
      return label ? (
        <Status
          status={`${label} · ${Math.round(original.churnRisk * 100)}%`}
          color={original.churnRisk >= 0.5 ? 'red' : 'yellow'}
          size="small"
        />
      ) : (
        <Text color="muted" variant="caption">
          Within tolerance
        </Text>
      )
    },
  },
]

export const ScenarioCustomers = ({
  result,
  base,
}: {
  result: ReplayResult
  base: string
}) => {
  const router = useRouter()
  const { counts, customers } = result
  return (
    <Box flexDirection="column" rowGap="xl">
      <Box flexDirection="column" rowGap="s">
        <Text variant="heading-xxs" as="h2">
          Customers
        </Text>
        <Text color="muted">
          {counts.up} up, {counts.down} down, {counts.atRisk} at risk.
        </Text>
      </Box>
      <DataTable
        columns={columns}
        data={customers}
        isLoading={false}
        getRowId={(row) => row.id}
        onRowClick={(row) =>
          router.push(`${base}/identities/${row.original.id}`)
        }
      />
    </Box>
  )
}
