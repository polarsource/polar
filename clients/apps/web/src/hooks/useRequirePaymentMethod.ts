import { useCustomerPaymentMethods } from '@/hooks/queries/customerPortal'
import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'
import type { Client } from '@polar-sh/client'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useCallback } from 'react'

export const useRequirePaymentMethod = (
  api: Client,
  customerSessionToken: string,
) => {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { data: paymentMethods, isPending } = useCustomerPaymentMethods(api)

  const withPaymentMethod = useCallback(
    async (action: () => Promise<void>) => {
      if (paymentMethods && paymentMethods.items.length > 0) {
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
    [paymentMethods, customerSessionToken, theme.resolvedTheme, queryClient],
  )

  return { withPaymentMethod, isPending }
}
