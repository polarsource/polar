import { useQuery } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import { voidKeys, voidRequest, voidSearch } from './api'
import {
  VoidMetrics,
  VoidReducerMetric,
  VoidReducerRecord,
} from './identityLive'

const startOfUtcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )

function toReducerMetric(
  reducer: VoidReducerRecord,
  metrics: VoidMetrics,
): VoidReducerMetric {
  const series = metrics.series[0]
  return {
    id: reducer.id,
    slug: reducer.slug,
    total: series?.total ?? null,
    periods: series?.periods ?? [],
  }
}

async function fetchReducerMetrics(
  organizationId: string,
): Promise<VoidReducerMetric[]> {
  const now = new Date()
  const start = startOfUtcDay(subDays(now, 29)).toISOString()
  const end = now.toISOString()
  const reducers = (
    await voidRequest<VoidReducerRecord[]>(organizationId, '/reducers')
  ).filter((reducer) => reducer.type === 'scalar')
  const metrics = await Promise.all(
    reducers.map((reducer) =>
      voidRequest<VoidMetrics>(
        organizationId,
        `/metrics${voidSearch({
          reducer_id: reducer.id,
          start,
          end,
          interval: 'day',
        })}`,
      ),
    ),
  )
  return reducers.map((reducer, index) =>
    toReducerMetric(reducer, metrics[index]),
  )
}

export function useVoidReducerMetrics(
  organizationId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: voidKeys.reducerMetrics(organizationId),
    queryFn: () => fetchReducerMetrics(organizationId),
    retry: false,
    ...options,
  })
}
