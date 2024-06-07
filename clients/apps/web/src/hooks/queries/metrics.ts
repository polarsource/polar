import { api } from '@/utils/api'
import { toISODate } from '@/utils/metrics'
import {
  Interval,
  MetricPeriod,
  Metrics,
  ProductPriceType,
  ResponseError,
} from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

interface GetMetricsRequest {
  startDate: Date
  endDate: Date
  interval: Interval
  organizationId?: string
  productId?: string
  productPriceType?: ProductPriceType
}

// @ts-ignore
export interface ParsedMetricPeriod extends MetricPeriod {
  timestamp: Date
}

interface ParsedMetricsResponse {
  periods: ParsedMetricPeriod[]
  metrics: Metrics
}

export const useMetrics = ({
  startDate,
  endDate,
  ...parameters
}: GetMetricsRequest): UseQueryResult<ParsedMetricsResponse, ResponseError> =>
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
      const metrics = await api.metrics.getMetrics({
        startDate: toISODate(startDate),
        endDate: toISODate(endDate),
        ...parameters,
      })
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
