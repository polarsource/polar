import { api } from '@/utils/client'
import { toISODate } from '@/utils/metrics'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

type MetricEntry = string | string[]

interface GetMetricsRequest {
  startDate: Date
  endDate: Date
  interval: schemas['TimeInterval']
  organization_id?: string
  product_id?: string[]
  customer_id?: string[]
  metrics?: MetricEntry[]
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
  { startDate, endDate, metrics, ...parameters }: GetMetricsRequest,
  enabled: boolean = true,
): UseQueryResult<ParsedMetricsResponse, Error> => {
  const flatMetrics = metrics?.flatMap((m) => (Array.isArray(m) ? m : [m]))
  const timezone = Intl.DateTimeFormat().resolvedOptions()
    .timeZone as operations['metrics:get']['parameters']['query']['timezone']
  return useQuery({
    queryKey: [
      'metrics',
      {
        startDate: toISODate(startDate),
        endDate: toISODate(endDate),
        timezone,
        metrics: flatMetrics,
        ...parameters,
      },
    ],
    queryFn: async () => {
      const result = await unwrap(
        api.GET('/v1/metrics/', {
          params: {
            query: {
              start_date: toISODate(startDate),
              end_date: toISODate(endDate),
              timezone,
              ...parameters,
              metrics: flatMetrics,
            },
          },
        }),
      )
      return {
        ...result,
        periods: result.periods.map((period) => ({
          ...period,
          timestamp: new Date(period.timestamp),
        })) as ParsedMetricPeriod[],
      }
    },
    retry: defaultRetry,
    enabled,
  })
}
