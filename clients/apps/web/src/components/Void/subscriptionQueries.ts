import { useQuery } from '@tanstack/react-query'
import { voidKeys, voidRequest } from './api'
import { VoidProductSubscriptionRecord } from './identityLive'

export const useVoidSubscriptions = (
  organizationId: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: voidKeys.subscriptions(organizationId),
    queryFn: () =>
      voidRequest<VoidProductSubscriptionRecord[]>(
        organizationId,
        '/subscriptions',
      ),
    retry: false,
    ...options,
  })
