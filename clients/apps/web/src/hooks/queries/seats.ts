import { api, createClientSideAPI } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCustomerOrders, useCustomerSubscriptions } from './customerPortal'
import { defaultRetry } from './retry'

type SeatAssignVariables = Omit<
  schemas['SeatAssign'],
  'subscription_id' | 'order_id' | 'immediate_claim'
>

/**
 * Post-checkout seat assignment via the customer portal endpoint. Looks up
 * the subscription or order produced by the checkout, then POSTs the seat
 * with the customer session token issued on confirm.
 *
 * Mount only after confirming the checkout is seat-based and the customer
 * session token is set — the queries fetch unconditionally on mount.
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

  const subscriptions = useCustomerSubscriptions(portalApi)
  const orders = useCustomerOrders(portalApi)

  const containerRef = useMemo(() => {
    const subscription = subscriptions.data?.items.find(
      (s) => s.checkout_id === checkoutId,
    )
    if (subscription) return { subscription_id: subscription.id } as const
    const order = orders.data?.items.find((o) => o.checkout_id === checkoutId)
    if (order) return { order_id: order.id } as const
    return null
  }, [checkoutId, subscriptions.data, orders.data])

  const mutation = useMutation({
    mutationFn: async (variables: SeatAssignVariables) => {
      if (!containerRef) {
        throw new Error('No subscription or order found for this checkout')
      }
      const result = await portalApi.POST('/v1/customer-portal/seats', {
        body: { ...variables, ...containerRef, immediate_claim: false },
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

  return { ...mutation, isReady: !!containerRef }
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
