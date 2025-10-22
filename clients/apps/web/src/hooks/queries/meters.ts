import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  UseQueryResult,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useMetersInfinite = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['meters:list']['parameters']['query']>,
    'organization_id' | 'page'
  >,
) =>
  useInfiniteQuery({
    queryKey: ['infinite', 'meters', { organizationId, parameters }],
    queryFn: async ({ pageParam }) =>
      unwrap(
        api.GET('/v1/meters/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
              page: pageParam,
            },
          },
        }),
      ),
    retry: defaultRetry,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (
        lastPageParam === lastPage.pagination.max_page ||
        lastPage.items.length === 0
      ) {
        return null
      }

      return lastPageParam + 1
    },
  })

export const useMeters = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['meters:list']['parameters']['query']>,
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

export const useMeter = (id: string, initialData?: schemas['Meter']) =>
  useQuery({
    queryKey: ['meters', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/meters/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
    initialData,
  })

export type ParsedMeterQuantities = schemas['MeterQuantities'] & {
  quantities: {
    timestamp: Date
    quantity: number
  }[]
}

export const useMeterQuantities = (
  id: string,
  parameters?: Omit<
    NonNullable<operations['meters:quantities']['parameters']['query']>,
    'id'
  >,
): UseQueryResult<ParsedMeterQuantities, Error> =>
  useQuery({
    queryKey: [
      'meters',
      'quantities',
      {
        id,
        ...(parameters || {}),
      },
    ],
    queryFn: async () => {
      const { start_timestamp, end_timestamp, interval } = parameters || {}
      const result = await unwrap(
        api.GET('/v1/meters/{id}/quantities', {
          params: {
            path: { id },
            query: {
              start_timestamp: start_timestamp ?? '',
              end_timestamp: end_timestamp ?? '',
              interval: interval as schemas['TimeInterval'],
              ...(parameters || {}),
            },
          },
        }),
      )
      return {
        ...result,
        quantities: result.quantities.map((quantity) => ({
          ...quantity,
          timestamp: new Date(quantity.timestamp),
        })) as ParsedMeterQuantities['quantities'],
      }
    },
    retry: defaultRetry,
  })

export const useCreateMeter = (organizationId: string) =>
  useMutation({
    mutationFn: (data: schemas['MeterCreate']) =>
      api.POST('/v1/meters/', {
        body: { ...data, organization_id: organizationId },
      }),
    onSuccess: async (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({
        queryKey: ['meters', { organizationId }],
      })
      queryClient.invalidateQueries({
        queryKey: ['infinite', 'meters', { organizationId }],
      })
    },
  })

export const useUpdateMeter = (id: string) =>
  useMutation({
    mutationFn: (body: schemas['MeterUpdate']) =>
      api.PATCH('/v1/meters/{id}', {
        params: { path: { id } },
        body,
      }),
    onSuccess: async (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({
        queryKey: ['meters', { id }],
      })
      queryClient.invalidateQueries({
        queryKey: ['meters', 'events', { id }],
      })
      queryClient.invalidateQueries({
        queryKey: ['meters', { organizationId: data.organization_id }],
      })
      queryClient.invalidateQueries({
        queryKey: ['meters', 'quantities', { id }],
      })
      queryClient.invalidateQueries({
        queryKey: [
          'infinite',
          'meters',
          { organizationId: data.organization_id },
        ],
      })
    },
  })
