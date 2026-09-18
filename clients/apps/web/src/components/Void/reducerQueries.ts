import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import { voidKeys, voidRequest, voidSearch } from './api'
import { VoidMetrics } from './identityLive'
import {
  VoidMeterDefinition,
  VoidReducerDefinition,
  VoidReducerSeries,
} from './reducers'

const EPOCH = new Date('2000-01-01T00:00:00Z')

type Enabled = { enabled?: boolean }

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

async function metricsOf(
  organizationId: string,
  reducerId: string,
  start: Date,
  end: Date,
  interval: 'day' | 'year',
): Promise<VoidMetrics> {
  return voidRequest<VoidMetrics>(
    organizationId,
    `/metrics${voidSearch({
      reducer_id: reducerId,
      start: start.toISOString(),
      end: end.toISOString(),
      interval,
    })}`,
  )
}

async function fetchReducerSeries(
  organizationId: string,
  id: string,
): Promise<VoidReducerSeries> {
  const now = new Date()
  const since = startOfUtcDay(subDays(now, 29))
  const [recent, allTime] = await Promise.all([
    metricsOf(organizationId, id, since, now, 'day'),
    metricsOf(organizationId, id, EPOCH, now, 'year'),
  ])
  return {
    total: recent.series[0]?.total ?? null,
    allTime: allTime.series[0]?.total ?? null,
    periods: recent.series[0]?.periods ?? [],
  }
}

export function useVoidReducers(
  organizationId: string,
  options?: Enabled,
): UseQueryResult<VoidReducerDefinition[]> {
  return useQuery({
    queryKey: voidKeys.reducers(organizationId),
    queryFn: () =>
      voidRequest<VoidReducerDefinition[]>(organizationId, '/reducers'),
    retry: false,
    ...options,
  })
}

export function useVoidReducer(
  organizationId: string,
  id: string,
): UseQueryResult<VoidReducerDefinition> {
  return useQuery({
    queryKey: voidKeys.reducer(organizationId, id),
    queryFn: () =>
      voidRequest<VoidReducerDefinition>(
        organizationId,
        `/reducers/${encodeURIComponent(id)}`,
      ),
    retry: false,
    enabled: Boolean(id),
  })
}

export function useVoidMeterDefinitions(
  organizationId: string,
  options?: Enabled,
): UseQueryResult<VoidMeterDefinition[]> {
  return useQuery({
    queryKey: voidKeys.meters(organizationId),
    queryFn: () =>
      voidRequest<VoidMeterDefinition[]>(organizationId, '/meters'),
    retry: false,
    ...options,
  })
}

export function useVoidReducerSeries(
  organizationId: string,
  id: string,
  options?: Enabled,
): UseQueryResult<VoidReducerSeries> {
  return useQuery({
    queryKey: voidKeys.reducerSeries(organizationId, id),
    queryFn: () => fetchReducerSeries(organizationId, id),
    retry: false,
    enabled: Boolean(id) && (options?.enabled ?? true),
  })
}
