'use client'

import { LoadingBox } from '@/components/Shared/LoadingBox'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatHumanFriendlyScalar } from '@/utils/formatters'
import { DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'
import { useVoidMeters } from './meterQueries'
import {
  VoidMeterRow,
  formatBilled,
  formatUnitPrice,
  meterHref,
} from './meters'
import { VoidDetailShell, VoidErrorBox } from './VoidShell'

const meterColumns: DataTableColumnDef<VoidMeterRow>[] = [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Meter',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column" minWidth={0}>
        <Text>{original.name}</Text>
        <Text color="muted" variant="caption">
          {original.slug}
        </Text>
      </Box>
    ),
  },
  {
    id: 'price',
    enableSorting: false,
    header: 'Unit price',
    cell: ({ row: { original } }) => formatUnitPrice(original),
  },
  {
    id: 'units',
    enableSorting: false,
    header: 'Units / 30d',
    cell: ({ row: { original } }) => formatHumanFriendlyScalar(original.units),
  },
  {
    id: 'billed',
    enableSorting: false,
    header: 'Billed / 30d',
    cell: ({ row: { original } }) =>
      formatBilled(original.billed, original.currency),
  },
]

export const VoidMetersPage = () => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const router = useRouter()
  const { meters, loading, error } = useVoidMeters()
  const billed = meters.reduce((sum, meter) => sum + meter.billed, 0)
  const units = meters.reduce((sum, meter) => sum + meter.units, 0)

  if (loading) {
    return (
      <VoidDetailShell title="Meters">
        <LoadingBox height={128} borderRadius="m" />
      </VoidDetailShell>
    )
  }

  if (error) {
    return (
      <VoidDetailShell title="Meters">
        <VoidErrorBox message={error.message} />
      </VoidDetailShell>
    )
  }

  return (
    <VoidDetailShell title="Meters">
      <Box flexDirection="column" rowGap="3xl">
        <Box
          display={{ base: 'grid', xl: 'flex' }}
          gridTemplateColumns="repeat(2, 1fr)"
          gap={{ base: 'l', md: 'xl' }}
        >
          <StatisticCard title="Meters" size="lg" valueClassName="font-sans">
            {meters.length}
          </StatisticCard>
          <StatisticCard
            title="Billed / 30d"
            size="lg"
            valueClassName="font-sans"
          >
            {formatBilled(billed)}
          </StatisticCard>
          <StatisticCard
            title="Units / 30d"
            size="lg"
            valueClassName="font-sans"
          >
            {formatHumanFriendlyScalar(units)}
          </StatisticCard>
        </Box>
        {meters.length === 0 ? (
          <Box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            paddingVertical="3xl"
            rowGap="l"
          >
            <Text color="muted">No meters in this version</Text>
          </Box>
        ) : (
          <DataTable
            columns={meterColumns}
            data={meters}
            isLoading={false}
            getRowId={(row) => row.id}
            onRowClick={(row) => router.push(meterHref(base, row.original.id))}
          />
        )}
      </Box>
    </VoidDetailShell>
  )
}
