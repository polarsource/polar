import { useQuery } from '@tanstack/react-query'
import { customerPortalKeys } from '../core/keys'
import {
  createSubscriptionMethods,
  type ListSubscriptionsParams,
} from '../core/subscriptions'
import type { CustomerSubscription } from '../core/types'
import { useCustomerPortalContext } from './context'

export interface UseSubscriptionsOptions extends ListSubscriptionsParams {
  initialData?: CustomerSubscription[]
}

export function useSubscriptions(options: UseSubscriptionsOptions = {}) {
  const { client } = useCustomerPortalContext()
  const methods = createSubscriptionMethods(client)

  const { initialData, ...params } = options

  const query = useQuery({
    queryKey: [...customerPortalKeys.subscriptions(), params],
    queryFn: () => methods.getSubscriptions(params),
    initialData,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
