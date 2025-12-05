import { api } from '@/utils/client'
import { toISODate } from '@/utils/metrics'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

interface GetMetricsRequest {
  startDate: Date
  endDate: Date
  interval: schemas['TimeInterval']
  organization_id?: string
  product_id?: string[]
  customer_id?: string[]
  metrics?: string[]
}

export type ParsedMetricPeriod = schemas['MetricPeriod'] & {
  timestamp: Date
}

export interface ParsedMetricsResponse {
  periods: ParsedMetricPeriod[]
  totals: schemas['MetricsTotals']
  metrics: schemas['Metrics']
}

export const useMetrics = (
  { startDate, endDate, ...parameters }: GetMetricsRequest,
  enabled: boolean = true,
): UseQueryResult<ParsedMetricsResponse, Error> => {
  const timezone = Intl.DateTimeFormat().resolvedOptions()
    .timeZone as operations['metrics:get']['parameters']['query']['timezone']
  return useQuery({
    queryKey: [
      'metrics',
      {
        startDate: toISODate(startDate),
        endDate: toISODate(endDate),
        timezone,
        ...parameters,
      },
    ],
    queryFn: async () => {
      const metrics = await unwrap(
        api.GET('/v1/metrics/', {
          params: {
            query: {
              start_date: toISODate(startDate),
              end_date: toISODate(endDate),
              timezone,
              ...parameters,
            },
          },
        }),
      )
      return {
        ...metrics,
        periods: metrics.periods.map((period) => ({
          ...period,
          timestamp: new Date(period.timestamp),
        })) as ParsedMetricPeriod[],
      }
    },
    retry: defaultRetry,
    enabled,
  })
}
