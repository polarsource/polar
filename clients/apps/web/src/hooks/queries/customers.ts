import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCustomers = (
  organizationId: string,
  parameters?: Omit<
    operations['customers:list']['parameters']['query'],
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['customers', organizationId, parameters],
    queryFn: async () =>
      unwrap(
        api.GET('/v1/customers/', {
          params: {
            query: {
              organization_id: organizationId,
              ...parameters,
            },
          },
        }),
      ),
    retry: defaultRetry,
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
