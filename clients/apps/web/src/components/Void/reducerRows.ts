import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useContext, useMemo } from 'react'
import { useVoidDataSource } from './dataSource'
import { VoidReducerMetric } from './identityLive'
import { useVoidReducerMetrics } from './metricQueries'
import { getVoidReducerMetrics } from './mock'
import { FIXTURE_REDUCERS } from './reducerFixtures'
import { useVoidReducers } from './reducerQueries'
import { VoidReducerDefinition } from './reducers'

export interface ReducerRow {
  reducer: VoidReducerDefinition
  metric: VoidReducerMetric | undefined
}

export const toReducerRows = (
  reducers: VoidReducerDefinition[],
  metrics: VoidReducerMetric[],
): ReducerRow[] => {
  const metricsById = new Map(metrics.map((metric) => [metric.id, metric]))
  return [...reducers]
    .sort(
      (left, right) =>
        (metricsById.get(right.id)?.total ?? 0) -
        (metricsById.get(left.id)?.total ?? 0),
    )
    .map((reducer) => ({ reducer, metric: metricsById.get(reducer.id) }))
}

/** Every reducer in the active version with its 30-day metric, busiest first. */
export const useVoidReducerRows = () => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const reducersQuery = useVoidReducers(organization.id, { enabled: live })
  const metricsQuery = useVoidReducerMetrics(organization.id, { enabled: live })
  const fixtures = useMemo(() => getVoidReducerMetrics(), [])

  const rows = useMemo(
    () =>
      toReducerRows(
        live ? (reducersQuery.data ?? []) : FIXTURE_REDUCERS,
        live ? (metricsQuery.data ?? []) : fixtures,
      ),
    [fixtures, live, metricsQuery.data, reducersQuery.data],
  )

  return {
    rows,
    loading: live && (reducersQuery.isLoading || metricsQuery.isLoading),
    error: live ? (reducersQuery.error ?? metricsQuery.error) : null,
  }
}
