import { useCustomerPaymentMethods } from '@/hooks/queries/customerPortal'
import { isFreePrice } from '@/utils/product'
import { usePaymentMethodEmbed } from '@/hooks/usePaymentMethodEmbed'
import type { Client, schemas } from '@polar-sh/client'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

export const useRequirePaymentMethod = (
  api: Client,
  customerSessionToken: string,
  subscription: schemas['CustomerSubscription'],
) => {
  const openPaymentMethodEmbed = usePaymentMethodEmbed()
  const queryClient = useQueryClient()
  const { data: paymentMethods, isPending } = useCustomerPaymentMethods(api)

  const required = !subscription.prices.every(isFreePrice)

  const withPaymentMethod = useCallback(
    async (action: () => Promise<void>) => {
      if (!required || (paymentMethods && paymentMethods.items.length > 0)) {
        await action()
        return
      }

      await openPaymentMethodEmbed(customerSessionToken, async () => {
        await queryClient.invalidateQueries({
          queryKey: ['customer_payment_methods'],
        })
        await action()
      })
    },
    [
      required,
      paymentMethods,
      customerSessionToken,
      openPaymentMethodEmbed,
      queryClient,
    ],
  )

  return { withPaymentMethod, isPending: required && isPending }
}
