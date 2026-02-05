import type { CheckoutPublic } from '@spaire/sdk/models/components/checkoutpublic'
import { loadStripe } from '@stripe/stripe-js'
import { useCallback, useMemo, useState } from 'react'

export const useHandleNextAction = (
  checkout: CheckoutPublic,
): [boolean, () => Promise<void>, boolean] => {
  const [pending, setPending] = useState(false)
  const requiresAction = useMemo(() => {
    return (
      checkout.paymentProcessorMetadata?.intent_status === 'requires_action'
    )
  }, [checkout])

  const handleNextAction = useCallback(async () => {
    if (!requiresAction || pending) {
      return
    }
    const stripe = await loadStripe(
      checkout.paymentProcessorMetadata.publishable_key,
    )
    if (!stripe) {
      return
    }
    setPending(true)
    try {
      const { intent_client_secret } = checkout.paymentProcessorMetadata
      await stripe.handleCardAction(intent_client_secret)
    } finally {
      setPending(false)
    }
  }, [checkout, requiresAction, pending])

  return [requiresAction, handleNextAction, pending]
}
