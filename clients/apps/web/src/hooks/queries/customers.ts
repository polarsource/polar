import { api, queryClient } from '@/utils/api'
import { CustomersApiListRequest, CustomerUpdate } from '@polar-sh/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCustomers = (
  organizationId: string,
  parameters?: Omit<CustomersApiListRequest, 'organization_id'>,
) =>
  useQuery({
    queryKey: ['customers', organizationId, parameters],
    queryFn: () =>
      api.customers.list({
        organizationId: organizationId ?? '',
        ...(parameters || {}),
      }),
    retry: defaultRetry,
  })

export const useUpdateCustomer = (customerId: string, organizationId: string) =>
  useMutation({
    mutationFn: (data: CustomerUpdate) =>
      api.customers.update({ id: customerId, body: data }),
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['customers', organizationId],
      })
    },
  })
