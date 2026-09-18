'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { DataTable, DataTableColumnDef, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { ReactNode, useContext, useMemo } from 'react'
import { useVoidDataSource } from './dataSource'
import { VoidReducerMetric } from './identityLive'
import { useVoidReducerMetrics } from './metricQueries'
import { getVoidReducerMetrics } from './mock'
import { FIXTURE_REDUCERS } from './reducerFixtures'
import { useVoidReducers } from './reducerQueries'
import {
  capitalize,
  dayLabel,
  describeAggregation,
  formatReducerTotal,
  reducerHref,
  VoidReducerDefinition,
} from './reducers'
import { VoidErrorBox } from './VoidShell'
import { VoidSparkline } from './VoidSparkline'

interface ReducerRow {
  reducer: VoidReducerDefinition
  metric: VoidReducerMetric | undefined
}

const TYPE_COLOR = {
  scalar: 'blue',
  dict: 'gray',
} as const

const reducerColumns: DataTableColumnDef<ReducerRow>[] = [
  {
    id: 'reducer',
    enableSorting: false,
    header: 'Reducer',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column" minWidth={0}>
        <Text>{original.reducer.slug}</Text>
        <Text color="muted" variant="caption">
          {capitalize(describeAggregation(original.reducer.aggregation))}
        </Text>
      </Box>
    ),
  },
  {
    id: 'type',
    enableSorting: false,
    header: 'Type',
    size: 100,
    cell: ({ row: { original } }) => (
      <Status
        status={original.reducer.type}
        color={TYPE_COLOR[original.reducer.type]}
        size="small"
      />
    ),
  },
  {
    id: 'total',
    enableSorting: false,
    header: 'Total / 30d',
    size: 120,
    cell: ({ row: { original } }) => formatReducerTotal(original.metric?.total),
  },
  {
    id: 'activity',
    enableSorting: false,
    header: 'Activity',
    size: 200,
    cell: ({ row: { original } }) => {
      const metric = original.metric
      if (!metric || metric.periods.length === 0) {
        return <Text color="muted">—</Text>
      }
      return (
        <Box width="100%" onClick={(event) => event.stopPropagation()}>
          <VoidSparkline
            values={metric.periods.map((period) => period.value)}
            labels={metric.periods.map((period) => dayLabel(period.timestamp))}
            height={36}
          />
        </Box>
      )
    },
  },
]

export function VoidReducersPage(): ReactNode {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const base = `/void/dashboard/${organization.slug}`
  const router = useRouter()
  const reducersQuery = useVoidReducers(organization.id, { enabled: live })
  const metricsQuery = useVoidReducerMetrics(organization.id, { enabled: live })
  const fixtures = useMemo(() => getVoidReducerMetrics(), [])
  const reducers = useMemo(
    () => (live ? (reducersQuery.data ?? []) : FIXTURE_REDUCERS),
    [live, reducersQuery.data],
  )
  const metrics = useMemo(
    () => (live ? (metricsQuery.data ?? []) : fixtures),
    [live, metricsQuery.data, fixtures],
  )
  const rows = useMemo(() => toRows(reducers, metrics), [reducers, metrics])
  const active = rows.filter((row) => (row.metric?.total ?? 0) > 0).length

  const loading = live && (reducersQuery.isLoading || metricsQuery.isLoading)
  const error = live ? (reducersQuery.error ?? metricsQuery.error) : null

  return (
    <DashboardBody title="Reducers">
      {loading ? (
        <LoadingBox height={128} borderRadius="m" />
      ) : error ? (
        <VoidErrorBox message={error.message} />
      ) : (
        <Box flexDirection="column" rowGap="3xl">
          <Box
            display={{ base: 'grid', xl: 'flex' }}
            gridTemplateColumns="repeat(2, 1fr)"
            gap={{ base: 'l', md: 'xl' }}
          >
            <StatisticCard
              title="Reducers"
              size="lg"
              valueClassName="font-sans"
            >
              {rows.length}
            </StatisticCard>
            <StatisticCard title="Active" size="lg" valueClassName="font-sans">
              {active}
            </StatisticCard>
            <StatisticCard
              title="No activity"
              size="lg"
              valueClassName="font-sans"
            >
              {rows.length - active}
            </StatisticCard>
          </Box>
          {rows.length === 0 ? (
            <Box
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              paddingVertical="3xl"
              rowGap="l"
            >
              <Text color="muted">No reducers in this version</Text>
            </Box>
          ) : (
            <DataTable
              columns={reducerColumns}
              data={rows}
              isLoading={false}
              wrapperClassName="overflow-visible"
              getRowId={(row) => row.reducer.id}
              onRowClick={(row) =>
                router.push(reducerHref(base, row.original.reducer.id))
              }
            />
          )}
        </Box>
      )}
    </DashboardBody>
  )
}

function toRows(
  reducers: VoidReducerDefinition[],
  metrics: VoidReducerMetric[],
): ReducerRow[] {
  const metricsById = new Map(metrics.map((metric) => [metric.id, metric]))
  return [...reducers]
    .sort(
      (left, right) =>
        (metricsById.get(right.id)?.total ?? 0) -
        (metricsById.get(left.id)?.total ?? 0),
    )
    .map((reducer) => ({
      reducer,
      metric: metricsById.get(reducer.id),
    }))
}
