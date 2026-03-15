import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { toISODate } from '@/utils/metrics'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { UseQueryResult, useMutation, useQuery } from '@tanstack/react-query'
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

export const useMetricDefinitions = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['metrics:list_definitions']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['metric_definitions', { organizationId, parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/metrics/definitions', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useCreateMetricDefinition = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['MetricDefinitionCreate']) =>
      api.POST('/v1/metrics/definitions', { body }),
    onSuccess: (result) => {
      if (result.error) return
      getQueryClient().invalidateQueries({
        queryKey: ['metric_definitions', { organizationId }],
      })
    },
  })

export const useUpdateMetricDefinition = (id: string, organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['MetricDefinitionUpdate']) =>
      api.PATCH('/v1/metrics/definitions/{id}', {
        params: { path: { id } },
        body,
      }),
    onSuccess: (result) => {
      if (result.error) return
      getQueryClient().invalidateQueries({
        queryKey: ['metric_definitions', { organizationId }],
      })
    },
  })

export const useDeleteMetricDefinition = (id: string, organizationId: string) =>
  useMutation({
    mutationFn: () =>
      api.DELETE('/v1/metrics/definitions/{id}', { params: { path: { id } } }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['metric_definitions', { organizationId }],
      })
    },
  })

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
