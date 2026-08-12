'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerPaymentMethods,
  useCustomerUncancelSubscription,
} from '@/hooks/queries/customerPortal'
import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'
import type { Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'

const UncancelSubscriptionButton = ({
  api,
  subscription,
  customerSessionToken,
  onUncancelled,
}: {
  api: Client
  subscription: schemas['CustomerSubscription']
  customerSessionToken: string
  onUncancelled: () => Promise<void>
}) => {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const uncancelSubscription = useCustomerUncancelSubscription(api)
  const {
    data: paymentMethods,
    isPending: paymentMethodsPending,
    isError: paymentMethodsError,
  } = useCustomerPaymentMethods(api)

  const uncancel = async () => {
    const { error } = await uncancelSubscription.mutateAsync({
      id: subscription.id,
    })
    if (error) {
      toast({
        title: 'Failed to uncancel subscription',
        description:
          typeof error.detail === 'string'
            ? error.detail
            : 'An error occurred while uncancelling the subscription.',
        variant: 'error',
      })
      return
    }
    await onUncancelled()
  }

  const onClick = async () => {
    if (
      paymentMethodsError ||
      (paymentMethods && paymentMethods.items.length > 0)
    ) {
      await uncancel()
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
      await uncancel()
    })
  }

  return (
    <Button
      onClick={onClick}
      loading={uncancelSubscription.isPending || paymentMethodsPending}
      disabled={uncancelSubscription.isPending || paymentMethodsPending}
    >
      Uncancel
    </Button>
  )
}

export default UncancelSubscriptionButton
