'use client'

import { useAuth } from '@/hooks/auth'
import {
  DonationStripePaymentIntentMutationResponse,
  PaymentMethod,
} from '@polar-sh/sdk'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import {
  PaymentIntent,
  StripePaymentElementChangeEvent,
} from '@stripe/stripe-js'
import Button from 'polarkit/components/ui/atoms/button'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { useState } from 'react'
import Subtotal from './Subtotal'

const PaymentForm = ({
  paymentIntent,
  isSyncing,
  setErrorMessage,
  onSuccess,
  redirectTo,
  isValid,
  paymentMethod,
  canSavePaymentMethod,
  onSavePaymentMethodChanged,
}: {
  paymentIntent?: DonationStripePaymentIntentMutationResponse
  isSyncing: boolean
  setErrorMessage: (message: string) => void
  onSuccess: (paymentIntent: PaymentIntent) => void
  isValid: boolean
  redirectTo: string
  paymentMethod?: PaymentMethod
  canSavePaymentMethod: boolean
  onSavePaymentMethodChanged: (save: boolean) => void
}) => {
  const stripe = useStripe()
  const elements = useElements()
  const { currentUser } = useAuth()

  const [isStripeCompleted, setStripeCompleted] = useState(false)

  const havePaymentMethod = paymentMethod || isStripeCompleted

  const [stripeSyncing, setStripeSyncing] = useState(false)

  const canSubmit =
    !isSyncing &&
    !stripeSyncing &&
    paymentIntent &&
    havePaymentMethod &&
    isValid

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

  const submitWithExistingPaymentMethod = async () => {
    if (!stripe || !paymentIntent?.client_secret) {
      throw new Error('unable to submitWithExistingPaymentMethod')
    }

    return await stripe.confirmCardPayment(paymentIntent.client_secret, {
      payment_method: paymentMethod?.stripe_payment_method_id,
      return_url: redirectTo,
    })
  }

  const submitWithStripeElement = async () => {
    if (!stripe || !elements) {
      throw new Error('unable to submitWithStripeElement')
    }

    return await stripe.confirmPayment({
      //`Elements` instance that was used to create the Payment Element
      elements,
      confirmParams: {
        return_url: redirectTo,
      },
      redirect: 'if_required',
    })
  }

  const onSubmit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()

    if (!stripe) {
      // Stripe.js has not yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return
    }

    setStripeSyncing(true)
    setErrorMessage('')

    const res = paymentMethod
      ? submitWithExistingPaymentMethod()
      : submitWithStripeElement()

    return await res
      .then(({ paymentIntent, error }) => {
        if (!paymentIntent) {
          if (error && error.message) {
            throw new Error(error.message)
          } else {
            throw new Error('No Payment Intent Created')
          }
        }
        handlePayment(paymentIntent)
        // syncing is still true here, to make sure that it keeps spinning until the user is redirected.
      })
      .catch((error) => {
        setErrorMessage(error.message)
        setStripeSyncing(false)
      })
  }

  const [
    stripeElementsCurrentPaymentType,
    setStripeElementsCurrentPaymentType,
  ] = useState('')

  const onStripeFormChange = (event: StripePaymentElementChangeEvent) => {
    setStripeCompleted(event.complete)
    setStripeElementsCurrentPaymentType(event.value.type)

    // Don't offer saving payment methods if the type is not card
    if (event.value.type !== 'card') {
      onSavePaymentMethodChanged(false)
    }
  }

  return (
    <div className="dark:border-polar-500 flex flex-col gap-4 border-t pt-5">
      {!paymentMethod && (
        <PaymentElement
          onChange={onStripeFormChange}
          options={{
            defaultValues: {
              billingDetails: {
                email: currentUser?.email,
              },
            },
          }}
        />
      )}

      <Subtotal paymentIntent={paymentIntent} />

      {!paymentMethod &&
        canSavePaymentMethod &&
        stripeElementsCurrentPaymentType === 'card' && (
          <div className="items-top flex items-center space-x-2">
            <Checkbox
              id="save_payment_method"
              onCheckedChange={(e) => onSavePaymentMethodChanged(Boolean(e))}
            />
            <div className="grid leading-none">
              <label
                htmlFor="save_payment_method"
                className="dark:text-polar-400 text-sm font-medium text-gray-500"
              >
                Save payment method for future usage
              </label>
            </div>
          </div>
        )}

      <div>
        <Button
          size="lg"
          disabled={!canSubmit}
          loading={isSyncing || stripeSyncing}
          onClick={onSubmit}
          fullWidth
        >
          Donate
        </Button>
      </div>
    </div>
  )
}

export default PaymentForm
