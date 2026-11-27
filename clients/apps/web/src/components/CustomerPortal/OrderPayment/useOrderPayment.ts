import { useCustomerOrderPay } from '@/hooks/queries/customerPortal'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { type Client, type schemas } from '@polar-sh/client'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 90

export type OrderPaymentSource =
  | { elements: StripeElements }
  | { paymentMethodId: string }
  | null

export type OrderPaymentState =
  | { status: 'idle' }
  | { status: 'paying' }
  | { status: 'confirming' }
  | { status: 'succeeded' }
  | { status: 'failed'; error: string }

const EMPTY_BILLING_DETAILS = {
  name: null,
  email: null,
  phone: null,
  address: {
    line1: null,
    line2: null,
    postal_code: null,
    city: null,
    state: null,
    country: null,
  },
}

const getPayBody = async (
  stripe: Stripe | null,
  source: OrderPaymentSource,
): Promise<schemas['CustomerOrderPay'] | { error: string }> => {
  if (source === null) {
    return {}
  }
  if ('paymentMethodId' in source) {
    return { payment_method_id: source.paymentMethodId }
  }
  if (!stripe) {
    return { error: 'The payment form failed to load. Refresh the page.' }
  }
  const { error: submitError } = await source.elements.submit()
  if (submitError) {
    return { error: submitError.message || 'Check your card details.' }
  }
  const { confirmationToken, error } = await stripe.createConfirmationToken({
    elements: source.elements,
    params: {
      payment_method_data: { billing_details: EMPTY_BILLING_DETAILS },
    },
  })
  if (error || !confirmationToken) {
    return { error: error?.message || 'Check your card details.' }
  }
  return {
    payment_processor: 'stripe',
    confirmation_token_id: confirmationToken.id,
  }
}

export const useOrderPayment = ({
  api,
  orderId,
  isDraft,
}: {
  api: Client
  orderId: string
  // A failed payment reverts a draft order back to draft. A pending order
  // stays pending and its latest payment may be an earlier failed attempt, so
  // only a successful payment can be detected while confirming.
  isDraft: boolean
}) => {
  const payOrder = useCustomerOrderPay(api)
  const [state, setState] = useState<OrderPaymentState>({
    status: 'idle',
  })

  useEffect(() => {
    if (state.status !== 'confirming') {
      return
    }
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      const { data: order } = await api.GET('/v1/customer-portal/orders/{id}', {
        params: { path: { id: orderId } },
      })
      if (order?.status === 'paid') {
        clearInterval(interval)
        setState({ status: 'succeeded' })
      } else if (isDraft && order?.status === 'draft') {
        clearInterval(interval)
        const { data: payment } = await api.GET(
          '/v1/customer-portal/orders/{id}/payment-status',
          { params: { path: { id: orderId } } },
        )
        setState({
          status: 'failed',
          error:
            payment?.error ||
            'Your payment failed. Try again or use another card.',
        })
      } else if (attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(interval)
        setState({
          status: 'failed',
          error:
            'Your payment is still being confirmed. Check back in a few minutes.',
        })
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [state.status, api, orderId, isDraft])

  const fail = (error: string) => setState({ status: 'failed', error })

  const pay = async (
    stripe: Stripe | null,
    source: OrderPaymentSource,
  ): Promise<schemas['ValidationError'][] | undefined> => {
    setState({ status: 'paying' })

    const body = await getPayBody(stripe, source)
    if ('error' in body) {
      fail(body.error)
      return
    }

    try {
      const { data: order, error } = await payOrder.mutateAsync({
        id: orderId,
        body,
      })
      if (error || !order) {
        if (error && 'detail' in error && Array.isArray(error.detail)) {
          setState({ status: 'idle' })
          return error.detail
        }
        fail(extractApiErrorMessage(error ?? {}, 'Your payment failed.'))
        return
      }

      const metadata = order.payment_processor_metadata
      if (metadata.intent_status === 'requires_action') {
        if (!stripe || !metadata.intent_client_secret) {
          fail('Your card needs to be authenticated. Refresh and try again.')
          return
        }
        const { error: actionError } = await stripe.handleNextAction({
          clientSecret: metadata.intent_client_secret,
        })
        if (actionError) {
          fail(actionError.message || 'Your card could not be authenticated.')
          return
        }
      }
      setState({ status: 'confirming' })
    } catch {
      fail('Network error. Check your connection and try again.')
    }
  }

  return { state, pay, reset: () => setState({ status: 'idle' }) }
}
