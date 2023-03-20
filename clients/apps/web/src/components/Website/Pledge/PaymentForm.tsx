'use client'

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useRouter } from 'next/router'
import { type PledgeRead } from 'polarkit/api/client'
import PrimaryButton from 'polarkit/components/ui/PrimaryButton'
import { getCentsInDollarString } from 'polarkit/utils'
import { useState } from 'react'

const PaymentForm = ({
  pledge,
  isSyncing,
  setSyncing,
  setErrorMessage,
}: {
  pledge?: PledgeRead
  isSyncing: boolean
  setSyncing: (isLocked: boolean) => void
  setErrorMessage: (message: string) => void
}) => {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()

  const [isStripeCompleted, setStripeCompleted] = useState(false)
  const canSubmit = !isSyncing && pledge && isStripeCompleted
  const amount = pledge?.amount || 0

  const generateRedirectURL = (paymentIntent?) => {
    const statusURL = new URL(window.location.href + '/status')
    if (pledge) {
      statusURL.searchParams.append('pledge_id', pledge.id)
    }
    if (!paymentIntent) {
      return statusURL.toString()
    }

    /*
     * Same location & query params as the serverside redirect from Stripe if required
     * by the payment method - easing the implementation.
     */
    statusURL.searchParams.append('payment_intent_id', paymentIntent.id)
    statusURL.searchParams.append(
      'payment_intent_client_secret',
      paymentIntent.client_secret,
    )
    statusURL.searchParams.append('redirect_status', paymentIntent.status)
    return statusURL.toString()
  }

  const redirect = (paymentIntent) => {
    const location = generateRedirectURL(paymentIntent)
    router.replace(location)
  }

  const handlePayment = (paymentIntent) => {
    switch (paymentIntent.status) {
      case 'succeeded':
      case 'processing':
        redirect(paymentIntent)
        break

      case 'requires_payment_method':
        setErrorMessage('Payment failed. Please try another payment method.')
        break

      default:
        setErrorMessage('Something went wrong.')
        break
    }
  }

  const onSubmit = async (event) => {
    event.preventDefault()

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return
    }

    setSyncing(true)
    setErrorMessage(null)
    return await stripe
      .confirmPayment({
        //`Elements` instance that was used to create the Payment Element
        elements,
        confirmParams: {
          return_url: generateRedirectURL(),
        },
        redirect: 'if_required',
      })
      .then(({ paymentIntent }) => {
        handlePayment(paymentIntent)
      })
      .catch((error) => {
        setErrorMessage(error.message)
      })
      .finally(() => setSyncing(false))
  }

  const onStripeFormChange = (event) => {
    setStripeCompleted(event.complete)
  }

  return (
    <div className="mt-5">
      <PaymentElement onChange={onStripeFormChange} />

      <div className="mt-6">
        <PrimaryButton
          disabled={!canSubmit}
          loading={isSyncing}
          onClick={onSubmit}
        >
          Pledge ${getCentsInDollarString(amount)}
        </PrimaryButton>
      </div>
    </div>
  )
}
export default PaymentForm
