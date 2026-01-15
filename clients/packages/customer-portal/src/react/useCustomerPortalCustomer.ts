import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCustomerMethods } from '../core/customer'
import { customerPortalKeys } from '../core/keys'
import type {
  CustomerPortalCustomer,
  CustomerPortalCustomerUpdate,
} from '../core/types'
import { useCustomerPortalContext } from './context'

export interface UseCustomerPortalCustomerOptions {
  initialData?: CustomerPortalCustomer
}

export function useCustomerPortalCustomer(
  options: UseCustomerPortalCustomerOptions = {},
) {
  const { client } = useCustomerPortalContext()
  const queryClient = useQueryClient()
  const methods = createCustomerMethods(client)

  const query = useQuery({
    queryKey: customerPortalKeys.customer(),
    queryFn: () => methods.getCustomer(),
    initialData: options.initialData,
  })

  const update = useMutation({
    mutationFn: (data: CustomerPortalCustomerUpdate) =>
      methods.updateCustomer(data),
    onSuccess: (updatedCustomer) => {
      queryClient.setQueryData(customerPortalKeys.customer(), updatedCustomer)
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    update,
  }
}
