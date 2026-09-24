'use client'

import { EmptyState } from '@/components/Shared/EmptyState'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import FunctionsOutlined from '@mui/icons-material/FunctionsOutlined'
import { DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { ReactNode, useContext, useMemo } from 'react'
import { VoidRequestError } from './api'
import { useVoidDataSource } from './dataSource'
import { getVoidReducerMetrics } from './mock'
import { FIXTURE_METERS, FIXTURE_REDUCERS } from './reducerFixtures'
import {
  useVoidMeterDefinitions,
  useVoidReducer,
  useVoidReducerSeries,
} from './reducerQueries'
import {
  capitalize,
  describeAggregation,
  MeterUsage,
  meterRoleLabel,
  metersUsing,
  seriesFromMetrics,
  usedByMetersLabel,
} from './reducers'
import { TableSection } from './VoidIdentityTables'
import { VoidReducerActivity } from './VoidReducerActivity'
import { VoidReducerDefinition } from './VoidReducerDefinition'
import { VoidDetailShell, VoidErrorBox } from './VoidShell'

interface VoidReducerPageProps {
  reducerId: string
}

const meterColumns: DataTableColumnDef<MeterUsage>[] = [
  {
    id: 'meter',
    enableSorting: false,
    header: 'Meter',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column" minWidth={0}>
        <Text>{original.meter.name}</Text>
        <Text color="muted" variant="caption">
          {original.meter.slug}
        </Text>
      </Box>
    ),
  },
  {
    id: 'role',
    enableSorting: false,
    header: 'Role',
    cell: ({ row: { original } }) => meterRoleLabel(original.role),
  },
]

export function VoidReducerPage({
  reducerId,
}: VoidReducerPageProps): ReactNode {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const base = `/void/dashboard/${organization.slug}`
  const router = useRouter()
  const query = useVoidReducer(organization.id, reducerId)
  const metersQuery = useVoidMeterDefinitions(organization.id, {
    enabled: live,
  })
  const fixture = useMemo(
    () => FIXTURE_REDUCERS.find((reducer) => reducer.id === reducerId),
    [reducerId],
  )
  const reducer = live ? query.data : fixture
  const seriesQuery = useVoidReducerSeries(organization.id, reducerId, {
    enabled: live && reducer?.type === 'scalar',
  })
  const fixtures = useMemo(() => getVoidReducerMetrics(), [])
  const series = live
    ? seriesQuery.data
    : seriesFromMetrics(reducerId, reducer?.type, fixtures)
  const notFound =
    live &&
    query.error instanceof VoidRequestError &&
    query.error.status === 404

  if (live && query.isLoading) {
    return (
      <VoidDetailShell title="Reducer">
        <LoadingBox height={128} borderRadius="m" />
      </VoidDetailShell>
    )
  }

  if (live && query.error && !notFound) {
    return (
      <VoidDetailShell title="Reducer">
        <VoidErrorBox message={query.error.message} />
      </VoidDetailShell>
    )
  }

  if (!reducer || notFound) {
    return (
      <VoidDetailShell title="Reducer">
        <EmptyState
          icon={<FunctionsOutlined fontSize="inherit" />}
          title="Unknown reducer"
          description="No reducer with this id exists."
        />
      </VoidDetailShell>
    )
  }

  const meters = live ? (metersQuery.data ?? []) : FIXTURE_METERS
  const used = metersUsing(meters, reducer.id)
  const loadingSeries =
    live && reducer.type === 'scalar' && seriesQuery.isLoading

  return (
    <VoidDetailShell
      title={reducer.slug}
      caption={[
        capitalize(describeAggregation(reducer.aggregation)),
        reducer.type,
        usedByMetersLabel(used.length),
      ].join(' · ')}
    >
      <Box flexDirection="column" rowGap="3xl">
        <TableSection title="Definition" caption="Events in, value out">
          <VoidReducerDefinition reducer={reducer} base={base} />
        </TableSection>
        <VoidReducerActivity
          name={reducer.slug}
          createdAt={reducer.created_at}
          type={reducer.type}
          series={series}
          loading={loadingSeries}
        />
        <ReducerMeters
          used={used}
          onOpen={(meterId) =>
            router.push(`${base}/definition/meters/${meterId}`)
          }
        />
        <Text variant="caption" color="muted" monospace>
          {reducer.id}
        </Text>
      </Box>
    </VoidDetailShell>
  )
}

function ReducerMeters({
  used,
  onOpen,
}: {
  used: MeterUsage[]
  onOpen: (meterId: string) => void
}): ReactNode {
  if (used.length === 0) return null
  return (
    <TableSection title="Meters" caption={`${used.length} in use`}>
      <DataTable
        columns={meterColumns}
        data={used}
        isLoading={false}
        getRowId={(row) => `${row.meter.id}-${row.role}`}
        onRowClick={(row) => onOpen(row.original.meter.id)}
      />
    </TableSection>
  )
}
