import { useCustomerPaymentMethods } from '@/hooks/queries/customerPortal'
import { isFreePrice } from '@/utils/product'
import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'
import type { Client, schemas } from '@polar-sh/client'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useCallback } from 'react'

export const useRequirePaymentMethod = (
  api: Client,
  customerSessionToken: string,
  subscription: schemas['CustomerSubscription'],
) => {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { data: paymentMethods, isPending } = useCustomerPaymentMethods(api)

  const required = !subscription.prices.every(isFreePrice)

  const withPaymentMethod = useCallback(
    async (action: () => Promise<void>) => {
      if (!required || (paymentMethods && paymentMethods.items.length > 0)) {
        await action()
        return
      }

      const embed = await PolarEmbedPaymentMethod.create({
        sessionToken: customerSessionToken,
        theme: theme.resolvedTheme === 'dark' ? 'dark' : 'light',
      })
      embed.addEventListener('success', async () => {
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
      theme.resolvedTheme,
      queryClient,
    ],
  )

  return { withPaymentMethod, isPending: required && isPending }
}
