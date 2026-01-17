import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customerPortalKeys } from '../core/keys'
import { createSubscriptionMethods } from '../core/subscriptions'
import type {
  CustomerSubscription,
  CustomerSubscriptionCancel,
  CustomerSubscriptionUpdate,
} from '../core/types'
import { useCustomerPortalContext } from './context'

export interface UseSubscriptionOptions {
  initialData?: CustomerSubscription
}

export function useSubscription(
  id: string,
  options: UseSubscriptionOptions = {},
) {
  const { client } = useCustomerPortalContext()
  const queryClient = useQueryClient()
  const methods = createSubscriptionMethods(client)

  const query = useQuery({
    queryKey: customerPortalKeys.subscription(id),
    queryFn: () => methods.getSubscription(id),
    initialData: options.initialData,
    enabled: !!id,
  })

  const chargePreviewQuery = useQuery({
    queryKey: customerPortalKeys.subscriptionChargePreview(id),
    queryFn: () => methods.getChargePreview(id),
    enabled: !!id && query.data?.status === 'active',
  })

  const cancel = useMutation({
    mutationFn: (
      data: Omit<CustomerSubscriptionCancel, 'cancel_at_period_end'> = {},
    ) => methods.cancelSubscription(id, data),
    onSuccess: (updatedSubscription) => {
      queryClient.setQueryData(
        customerPortalKeys.subscription(id),
        updatedSubscription,
      )
      queryClient.invalidateQueries({
        queryKey: customerPortalKeys.subscriptions(),
        exact: true,
      })
      queryClient.invalidateQueries({
        queryKey: customerPortalKeys.subscriptionChargePreview(id),
      })
    },
  })

  const uncancel = useMutation({
    mutationFn: () => methods.uncancelSubscription(id),
    onSuccess: (updatedSubscription) => {
      queryClient.setQueryData(
        customerPortalKeys.subscription(id),
        updatedSubscription,
      )
      queryClient.invalidateQueries({
        queryKey: customerPortalKeys.subscriptions(),
        exact: true,
      })
      queryClient.invalidateQueries({
        queryKey: customerPortalKeys.subscriptionChargePreview(id),
      })
    },
  })

  const update = useMutation({
    mutationFn: (data: CustomerSubscriptionUpdate) =>
      methods.updateSubscription(id, data),
    onSuccess: (updatedSubscription) => {
      queryClient.setQueryData(
        customerPortalKeys.subscription(id),
        updatedSubscription,
      )
      queryClient.invalidateQueries({
        queryKey: customerPortalKeys.subscriptions(),
        exact: true,
      })
      queryClient.invalidateQueries({
        queryKey: customerPortalKeys.subscriptionChargePreview(id),
      })
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    chargePreview: {
      data: chargePreviewQuery.data,
      isLoading: chargePreviewQuery.isLoading,
      isFetching: chargePreviewQuery.isFetching,
      error: chargePreviewQuery.error,
    },
    cancel,
    uncancel,
    update,
  }
}
