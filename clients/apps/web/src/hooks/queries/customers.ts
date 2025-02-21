import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { defaultRetry } from './retry'

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

export const useCreateCustomer = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['CustomerCreate']) =>
      api.POST('/v1/customers/', { body }),
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
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
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['customers', organizationId],
      })
    },
  })
