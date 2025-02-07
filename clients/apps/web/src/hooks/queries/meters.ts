import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { components, operations, unwrap } from '@polar-sh/client'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  UseQueryResult,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useMeters = (
  organizationId: string,
  parameters?: Omit<
    operations['meters:list']['parameters']['query'],
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['meters', { organizationId, parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/meters/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useMeter = (
  id: string,
  initialData?: components['schemas']['Meter'],
) =>
  useQuery({
    queryKey: ['meters', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/meters/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
    initialData,
  })

interface ParsedMeterQuantities {
  quantities: {
    timestamp: Date
    quantity: number
  }[]
}

export const useMeterEvents = (id: string) =>
  useInfiniteQuery({
    queryKey: ['meters', 'events', { id }],
    queryFn: async ({ pageParam }) =>
      unwrap(
        api.GET('/v1/meters/{id}/events', {
          params: { path: { id }, query: { page: pageParam, limit: 10 } },
        }),
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPageParam === lastPage.pagination.max_page ? null : lastPageParam + 1,
    retry: defaultRetry,
  })

export const useMeterQuantities = (
  id: string,
  startTimestamp: Date,
  endTimestamp: Date,
  interval: components['schemas']['TimeInterval'],
  parameters?: Omit<
    operations['meters:quantities']['parameters']['query'],
    'id' | 'startTimestamp' | 'endTimestamp' | 'interval'
  >,
): UseQueryResult<ParsedMeterQuantities, Error> =>
  useQuery({
    queryKey: [
      'meters',
      'quantities',
      { id, startTimestamp, endTimestamp, interval, ...(parameters || {}) },
    ],
    queryFn: async () => {
      const result = await unwrap(
        api.GET('/v1/meters/{id}/quantities', {
          params: {
            path: { id },
            query: {
              start_timestamp: startTimestamp.toISOString(),
              end_timestamp: endTimestamp.toISOString(),
              interval,
              ...(parameters || {}),
            },
          },
        }),
      )
      return {
        quantities: result.quantities.map((quantity) => ({
          ...quantity,
          timestamp: new Date(quantity.timestamp),
        })),
      }
    },
    retry: defaultRetry,
  })

export const useCreateMeter = (organizationId: string) =>
  useMutation({
    mutationFn: (data: components['schemas']['MeterCreate']) =>
      api.POST('/v1/meters/', {
        body: { ...data, organization_id: organizationId },
      }),
    onSuccess: async (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['meters', { organizationId }],
      })
    },
  })

export const useUpdateMeter = (id: string) =>
  useMutation({
    mutationFn: (body: components['schemas']['MeterUpdate']) =>
      api.PATCH('/v1/meters/{id}', {
        params: { path: { id } },
        body,
      }),
    onSuccess: async (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['meters', { id }],
      })
      queryClient.invalidateQueries({
        queryKey: ['meters', 'events', { id }],
      })
      queryClient.invalidateQueries({
        queryKey: ['meters', { organizationId: data.organization_id }],
      })
    },
  })
