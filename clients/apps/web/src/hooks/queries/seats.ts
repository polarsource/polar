import { api, createClientSideAPI } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { defaultRetry } from './retry'

type SeatAssignVariables = Omit<
  schemas['SeatAssign'],
  'subscription_id' | 'order_id' | 'checkout_id' | 'immediate_claim'
>

/**
 * Post-checkout seat assignment via the customer portal endpoint. Sends the
 * checkout_id; the backend resolves the subscription or order produced by
 * the checkout (scoped to the authenticated customer).
 */
export const useAssignSeatFromCheckout = (
  checkoutId: string,
  customerSessionToken: string,
) => {
  const queryClient = useQueryClient()
  const portalApi = useMemo(
    () => createClientSideAPI(customerSessionToken),
    [customerSessionToken],
  )

  return useMutation({
    mutationFn: async (variables: SeatAssignVariables) => {
      const result = await portalApi.POST('/v1/customer-portal/seats', {
        body: {
          ...variables,
          checkout_id: checkoutId,
          immediate_claim: false,
        },
      })
      if (result.error) {
        const detail = (result.error as { detail?: unknown }).detail
        throw new Error(
          typeof detail === 'string' ? detail : 'Failed to assign seat',
        )
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer_seats'] })
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
