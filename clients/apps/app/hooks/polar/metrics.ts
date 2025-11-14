import { usePolarClient } from '@/providers/PolarClientProvider'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'

/**
 * Converts a Date object to an ISO date string (YYYY-MM-DD) in local timezone.
 * Adjusts for timezone offset to ensure the local date is preserved.
 */
export const toISODate = (date: Date) => {
  // Offset the date by the timezone offset so that when converted to UTC,
  // we get the correct local date values
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().split('T')[0]
}

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
      const timezone = Intl.DateTimeFormat().resolvedOptions()
        .timeZone as operations['metrics:get']['parameters']['query']['timezone']
      const metrics = await unwrap(
        polar.GET('/v1/metrics/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
              start_date: toISODate(startDate),
              end_date: toISODate(endDate),
              timezone,
            },
          },
        }),
      )

      return {
        ...metrics,
        periods:
          metrics.periods.map((period) => ({
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
