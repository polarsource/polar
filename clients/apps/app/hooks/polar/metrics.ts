import { usePolarClient } from '@/providers/PolarClientProvider'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'

export const useMetrics = (
  organizationId: string | undefined,
  startDate: Date,
  endDate: Date,
  parameters: Omit<
    operations['metrics:get']['parameters']['query'],
    'start_date' | 'end_date'
  >,
  enabled = true,
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: [
      'metrics',
      organizationId,
      { ...parameters, startDate, endDate },
    ],
    queryFn: async () => {
      const metrics = await unwrap(
        polar.GET('/v1/metrics/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
            },
          },
        }),
      )
      return {
        ...metrics,
        periods:
          metrics.periods.map((period: schemas['MetricPeriod']) => ({
            ...period,
            timestamp: new Date(period.timestamp),
          })) ?? [],
      }
    },
    enabled: !!organizationId && enabled,
  })
}

export const toValueDataPoints = (
  metrics: ReturnType<typeof useMetrics>['data'] | undefined,
  key: Exclude<keyof schemas['MetricPeriod'], 'timestamp'>,
) => {
  if (!metrics) return []

  return metrics.periods.map((period) => ({
    value: period[key] ?? 0,
    date: period.timestamp,
  }))
}
