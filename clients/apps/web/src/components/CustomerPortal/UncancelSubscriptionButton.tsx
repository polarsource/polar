'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCustomerUncancelSubscription } from '@/hooks/queries/customerPortal'
import { useRequirePaymentMethod } from '@/hooks/useRequirePaymentMethod'
import { extractApiErrorMessage } from '@/utils/api/errors'
import type { Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'

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
  const uncancelSubscription = useCustomerUncancelSubscription(api)
  const { withPaymentMethod, isPending: paymentMethodsPending } =
    useRequirePaymentMethod(api, customerSessionToken, subscription)

  const uncancel = async () => {
    const { error } = await uncancelSubscription.mutateAsync({
      id: subscription.id,
    })
    if (error) {
      toast({
        title: 'Failed to uncancel subscription',
        description: extractApiErrorMessage(
          error,
          'An error occurred while uncancelling the subscription.',
        ),
        variant: 'error',
      })
      return
    }
    await onUncancelled()
  }

  return (
    <Button
      onClick={() => withPaymentMethod(uncancel)}
      loading={uncancelSubscription.isPending || paymentMethodsPending}
      disabled={uncancelSubscription.isPending || paymentMethodsPending}
    >
      Uncancel
    </Button>
  )
}

export default UncancelSubscriptionButton
