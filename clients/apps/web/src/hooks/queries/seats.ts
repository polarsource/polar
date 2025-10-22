import { getServerURL } from '@/utils/api'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useAssignSeatFromCheckout = (checkoutId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      email,
      metadata,
    }: {
      email: string
      metadata?: Record<string, any>
    }) => {
      const response = await fetch(`${getServerURL()}/v1/customer-seats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkout_id: checkoutId,
          email,
          metadata,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || 'Failed to assign seat')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate relevant queries if needed
      queryClient.invalidateQueries({
        queryKey: ['checkouts', checkoutId],
      })
    },
  })
}

/**
 * Dashboard hook to fetch seats for a subscription or order
 */
export const useOrganizationSeats = (parameters?: {
  subscriptionId?: string
  orderId?: string
}) =>
  useQuery({
    queryKey: ['organization_seats', parameters],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-seats', {
          params: {
            query: {
              ...(parameters?.subscriptionId && {
                subscription_id: parameters.subscriptionId,
              }),
              ...(parameters?.orderId && { order_id: parameters.orderId }),
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!parameters?.subscriptionId || !!parameters?.orderId,
  })
