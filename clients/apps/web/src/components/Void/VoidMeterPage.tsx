'use client'

import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { EmptyState } from '@/components/Shared/EmptyState'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatHumanFriendlyScalar } from '@/utils/formatters'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import { DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'
import { VoidRequestError } from './api'
import { identityHref } from './identities'
import { useVoidMeter } from './meterQueries'
import {
  billedCents,
  formatBilled,
  formatUnitPrice,
  meterSeriesToChart,
  reducerHref,
  VoidMeterConsumer,
  VoidMeterDetail,
  VoidMeterReducerRef,
} from './meters'
import { TableSection } from './VoidIdentityTables'
import { VoidDetailShell, VoidErrorBox } from './VoidShell'

const consumerColumns = (
  meter: VoidMeterDetail,
): DataTableColumnDef<VoidMeterConsumer>[] => [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Identity',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    accessorKey: 'units',
    enableSorting: false,
    header: 'Units / 30d',
    cell: ({ getValue }) => formatHumanFriendlyScalar(getValue() as number),
  },
  {
    id: 'billed',
    enableSorting: false,
    header: 'Billed / 30d',
    cell: ({ row: { original } }) =>
      formatBilled(billedCents(original.units, meter), meter.currency),
  },
]

const sourceColumns: DataTableColumnDef<{
  role: string
  reducer: VoidMeterReducerRef
}>[] = [
  {
    accessorKey: 'role',
    enableSorting: false,
    header: 'Role',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    id: 'reducer',
    enableSorting: false,
    header: 'Reducer',
    cell: ({ row: { original } }) => (
      <Text color="muted" monospace>
        {original.reducer.slug}
      </Text>
    ),
  },
]

export const VoidMeterPage = ({ meterId }: { meterId: string }) => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const router = useRouter()
  const { meter, loading, error } = useVoidMeter(meterId)
  const notFound = error instanceof VoidRequestError && error.status === 404

  if (loading) {
    return (
      <VoidDetailShell title="Meter">
        <LoadingBox height={128} borderRadius="m" />
      </VoidDetailShell>
    )
  }

  if (error && !notFound) {
    return (
      <VoidDetailShell title="Meter">
        <VoidErrorBox message={error.message} />
      </VoidDetailShell>
    )
  }

  if (!meter) {
    return (
      <VoidDetailShell title="Meter">
        <EmptyState
          icon={<DonutLargeOutlined fontSize="inherit" />}
          title="Unknown meter"
          description="No meter with this id exists in the current catalog."
        />
      </VoidDetailShell>
    )
  }

  const sources = [
    { role: 'Usage', reducer: meter.usageReducer },
    { role: 'Credits', reducer: meter.creditReducer },
  ]

  return (
    <VoidDetailShell
      title={meter.name}
      caption={[
        meter.slug,
        `${formatUnitPrice(meter)} / unit`,
        meter.usageReducer.slug,
      ].join(' · ')}
    >
      <Box flexDirection="column" rowGap="3xl">
        <Box
          display={{ base: 'grid', xl: 'flex' }}
          gridTemplateColumns="repeat(2, 1fr)"
          gap={{ base: 'l', md: 'xl' }}
        >
          <StatisticCard
            title="Units / 30d"
            size="lg"
            valueClassName="font-sans"
          >
            {formatHumanFriendlyScalar(meter.units)}
          </StatisticCard>
          <StatisticCard
            title="Credits / 30d"
            size="lg"
            valueClassName="font-sans"
          >
            {formatHumanFriendlyScalar(meter.credits)}
          </StatisticCard>
          <StatisticCard
            title="Billed / 30d"
            size="lg"
            valueClassName="font-sans"
          >
            {formatBilled(meter.billed, meter.currency)}
          </StatisticCard>
          <StatisticCard
            title="All-time units"
            size="lg"
            valueClassName="font-sans"
          >
            {formatHumanFriendlyScalar(meter.usage.allTime)}
          </StatisticCard>
        </Box>
        <TableSection title="Activity" caption="Last 30 days, daily · UTC">
          {meter.usage.periods.length > 0 ? (
            <MetricChartBox
              data={meterSeriesToChart(meter.usage, meter.name)}
              interval="day"
              metric="orders"
              height={200}
              chartType="line"
              shareable={false}
              exportable={false}
            />
          ) : (
            <Text color="muted">No usage in the last 30 days</Text>
          )}
        </TableSection>
        <TableSection
          title="Consumers"
          caption={
            meter.consumers.length > 0
              ? `Top ${meter.consumers.length} by units / 30d`
              : 'By customer, last 30 days'
          }
        >
          {meter.consumers.length === 0 ? (
            <Text color="muted">
              No customer consumed this meter in the last 30 days
            </Text>
          ) : (
            <DataTable
              columns={consumerColumns(meter)}
              data={meter.consumers}
              isLoading={false}
              getRowId={(row) => row.id}
              onRowClick={(row) =>
                router.push(identityHref(base, row.original.id))
              }
            />
          )}
        </TableSection>
        <TableSection title="Fed by" caption="The reducers behind this meter">
          <DataTable
            columns={sourceColumns}
            data={sources}
            isLoading={false}
            getRowId={(row) => row.role}
            onRowClick={(row) =>
              router.push(reducerHref(base, row.original.reducer.id))
            }
          />
        </TableSection>
      </Box>
    </VoidDetailShell>
  )
}
