import { api } from '@/utils/client'
import { toISODate } from '@/utils/metrics'
import { components, unwrap } from '@polar-sh/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

interface GetMetricsRequest {
  startDate: Date
  endDate: Date
  interval: components['schemas']['TimeInterval']
  organizationId?: string
  productId?: string[]
  customerId?: string[]
}

export type ParsedMetricPeriod = components['schemas']['MetricPeriod'] & {
  timestamp: Date
}

interface ParsedMetricsResponse {
  periods: ParsedMetricPeriod[]
  metrics: components['schemas']['Metrics']
}

export const useMetrics = ({
  startDate,
  endDate,
  ...parameters
}: GetMetricsRequest): UseQueryResult<ParsedMetricsResponse, Error> =>
  useQuery({
    queryKey: [
      'metrics',
      {
        startDate: toISODate(startDate),
        endDate: toISODate(endDate),
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
        })),
      }
    },
    retry: defaultRetry,
  })
