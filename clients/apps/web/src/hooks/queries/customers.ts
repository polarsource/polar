import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

const customerTimelineQuery = (organizationId: string, customerId: string) => ({
  organization_id: organizationId,
  customer_id: [customerId],
  source: 'system' as const,
})

export const useInfiniteCustomerTimeline = (
  organizationId: string,
  customerId: string,
) =>
  useInfiniteQuery({
    queryKey: ['customers', customerId, 'timeline', 'infinite'],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/events/', {
          params: {
            query: {
              ...customerTimelineQuery(organizationId, customerId),
              page: pageParam,
            },
          },
        }),
      ),
    retry: defaultRetry,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const pagination = lastPage.pagination
      if (lastPage.items.length === 0) return null
      if ('max_page' in pagination && lastPageParam === pagination.max_page)
        return null
      if ('has_next_page' in pagination && !pagination.has_next_page)
        return null
      return lastPageParam + 1
    },
    enabled: !!customerId && !!organizationId,
  })

export const useCustomerTimeline = (
  organizationId: string,
  customerId: string,
  limit: number = 10,
  page: number = 1,
) =>
  useQuery({
    queryKey: ['customers', customerId, 'timeline', { limit, page }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/', {
          params: {
            query: {
              ...customerTimelineQuery(organizationId, customerId),
              limit,
              page,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!customerId && !!organizationId,
  })

export const useCustomers = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['customers:list']['parameters']['query']>,
    'organization_id' | 'pageParam'
  >,
) =>
  useInfiniteQuery({
    queryKey: ['customers', organizationId, parameters],
    queryFn: async ({ pageParam }) =>
      unwrap(
        api.GET('/v1/customers/', {
          params: {
            query: {
              organization_id: organizationId,
              ...parameters,
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

export const useCustomer = (id: string | null) =>
  useQuery({
    queryKey: ['customers', 'id', id],
    queryFn: () => {
      return unwrap(
        api.GET('/v1/customers/{id}', {
          params: {
            path: {
              id: id ?? '',
            },
          },
        }),
      )
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateCustomer = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['CustomerCreate']) =>
      api.POST('/v1/customers/', { body }),
    onSuccess: async () => {
      getQueryClient().invalidateQueries({
        queryKey: ['customers', organizationId],
      })
    },
  })

export const useUpdateCustomer = (customerId: string, organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['CustomerUpdate']) =>
      api.PATCH('/v1/customers/{id}', {
        params: { path: { id: customerId } },
        body,
      }),
    onSuccess: async () => {
      getQueryClient().invalidateQueries({
        queryKey: ['customers', organizationId],
      })
    },
  })

export const useDeleteCustomer = (customerId: string, organizationId: string) =>
  useMutation({
    mutationFn: () =>
      api.DELETE('/v1/customers/{id}', {
        params: { path: { id: customerId } },
      }),
    onSuccess: async () => {
      getQueryClient().invalidateQueries({
        queryKey: ['customers', organizationId],
      })
    },
  })
