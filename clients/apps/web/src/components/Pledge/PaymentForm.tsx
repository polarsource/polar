'use client'

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import {
  PaymentIntent,
  StripePaymentElementChangeEvent,
} from '@stripe/stripe-js'
import { PledgeMutationResponse } from 'polarkit/api/client'
import { PrimaryButton } from 'polarkit/components/ui'
import { getCentsInDollarString } from 'polarkit/utils'
import { useState } from 'react'

export const generateRedirectURL = (
  pledge: PledgeMutationResponse,
  gotoURL?: string,
  paymentIntent?: PaymentIntent,
) => {
  let path = window.location.pathname + '/status'
  if (gotoURL && gotoURL.startsWith('/dashboard')) {
    path = gotoURL
  }

  const redirectURL = new URL(window.location.origin + path)
  if (pledge) {
    redirectURL.searchParams.append('pledge_id', pledge.id)
  }
  if (!paymentIntent) {
    return redirectURL.toString()
  }

  /*
   * Same location & query params as the serverside redirect from Stripe if required
   * by the payment method - easing the implementation.
   */
  redirectURL.searchParams.append('payment_intent_id', paymentIntent.id)
  if (paymentIntent.client_secret) {
    redirectURL.searchParams.append(
      'payment_intent_client_secret',
      paymentIntent.client_secret,
    )
  }
  redirectURL.searchParams.append('redirect_status', paymentIntent.status)
  return redirectURL.toString()
}

const PaymentForm = ({
  pledge,
  isSyncing,
  setSyncing,
  setErrorMessage,
  onSuccess,
  gotoURL,
}: {
  pledge?: PledgeMutationResponse
  isSyncing: boolean
  setSyncing: (isLocked: boolean) => void
  setErrorMessage: (message: string) => void
  onSuccess: (paymentIntent: PaymentIntent) => void
  gotoURL?: string
}) => {
  const stripe = useStripe()
  const elements = useElements()

  const [isStripeCompleted, setStripeCompleted] = useState(false)
  const canSubmit = !isSyncing && pledge && isStripeCompleted
  const amount = pledge?.amount || 0
  const fee = pledge?.fee || 0
  const amountIncludingFee = pledge?.amount_including_fee || 0

  const handlePayment = (paymentIntent: PaymentIntent) => {
    switch (paymentIntent.status) {
      case 'succeeded':
      case 'processing':
        onSuccess(paymentIntent)
        break

      case 'requires_payment_method':
        setErrorMessage('Payment failed. Please try another payment method.')
        break

      default:
        setErrorMessage('Something went wrong.')
        break
    }
  }

  const onSubmit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return
    }

    if (!pledge) {
      return
    }

    setSyncing(true)
    setErrorMessage('')
    return await stripe
      .confirmPayment({
        //`Elements` instance that was used to create the Payment Element
        elements,
        confirmParams: {
          return_url: generateRedirectURL(pledge, gotoURL),
        },
        redirect: 'if_required',
      })
      .then(({ paymentIntent }) => {
        if (!paymentIntent) {
          throw new Error('No Payment Intent Created')
        }
        handlePayment(paymentIntent)
      })
      .catch((error) => {
        setErrorMessage(error.message)
      })
      .finally(() => setSyncing(false))
  }

  const onStripeFormChange = (event: StripePaymentElementChangeEvent) => {
    setStripeCompleted(event.complete)
  }

  return (
    <div className="mt-3 border-t pt-5">
      <PaymentElement onChange={onStripeFormChange} />

      <div className="mt-6 mb-1 flex w-full text-sm text-gray-500">
        <div className="w-full">Pledge</div>
        <div className="w-full text-right">
          ${getCentsInDollarString(amount, true)}
        </div>
      </div>
      <div className="mb-1 flex w-full text-sm text-gray-500">
        <div className="w-1/2">
          Service fee <span className="text-xs">(Non-refundable)</span>
        </div>
        <div className="w-1/2 text-right">
          ${getCentsInDollarString(fee, true)}
        </div>
      </div>
      <div className="mb-6 flex w-full text-sm font-medium text-gray-900">
        <div className="w-1/2">Total</div>
        <div className="w-1/2 text-right">
          ${getCentsInDollarString(amountIncludingFee, true)}
        </div>
      </div>
      <div className="mt-6">
        <PrimaryButton
          disabled={!canSubmit}
          loading={isSyncing}
          onClick={onSubmit}
        >
          Pay ${getCentsInDollarString(amountIncludingFee)}
        </PrimaryButton>
      </div>
    </div>
  )
}
export default PaymentForm
