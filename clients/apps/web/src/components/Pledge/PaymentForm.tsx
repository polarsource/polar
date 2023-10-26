'use client'

import { useAuth } from '@/hooks/auth'
import {
  Issue,
  Organization,
  PaymentMethod,
  PledgeStripePaymentIntentMutationResponse,
  Repository,
} from '@polar-sh/sdk'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import {
  PaymentIntent,
  StripePaymentElementChangeEvent,
} from '@stripe/stripe-js'
import { Button } from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import posthog from 'posthog-js'
import { useEffect, useState } from 'react'
import Subtotal from './Subtotal'

const PaymentForm = ({
  paymentIntent,
  issue,
  organization,
  repository,
  isSyncing,
  setSyncing,
  setErrorMessage,
  onSuccess,
  redirectTo,
  hasDetails,
  paymentMethod,
  canSavePaymentMethod,
  onSavePaymentMethodChanged,
}: {
  paymentIntent?: PledgeStripePaymentIntentMutationResponse
  issue: Issue
  organization: Organization
  repository: Repository
  isSyncing: boolean
  setSyncing: (isLocked: boolean) => void
  setErrorMessage: (message: string) => void
  onSuccess: (paymentIntent: PaymentIntent) => void
  hasDetails: boolean
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

  const canSubmit =
    !isSyncing && paymentIntent && havePaymentMethod && hasDetails

  useEffect(() => {
    if (havePaymentMethod) {
      posthog.capture('Pledge Form Completed', {
        'Organization ID': organization.id,
        'Organization Name': organization.name,
        'Repository ID': repository.id,
        'Repository Name': repository.name,
        'Issue ID': issue.id,
        'Issue Number': issue.number,
      })
    }
  }, [
    havePaymentMethod,
    issue.id,
    issue.number,
    organization.id,
    organization.name,
    repository.id,
    repository.name,
  ])

  const handlePayment = (paymentIntent: PaymentIntent) => {
    switch (paymentIntent.status) {
      case 'succeeded':
      case 'processing':
        posthog.capture('Pledge Payment Success', {
          Status: paymentIntent.status,
          'Organization ID': organization.id,
          'Organization Name': organization.name,
          'Repository ID': repository.id,
          'Repository Name': repository.name,
          'Issue ID': issue.id,
          'Issue Number': issue.number,
        })
        onSuccess(paymentIntent)
        break

      case 'requires_payment_method':
        posthog.capture('Pledge Payment Failed', {
          Status: paymentIntent.status,
          'Organization ID': organization.id,
          'Organization Name': organization.name,
          'Repository ID': repository.id,
          'Repository Name': repository.name,
          'Issue ID': issue.id,
          'Issue Number': issue.number,
        })
        setErrorMessage('Payment failed. Please try another payment method.')
        break

      default:
        posthog.capture('Pledge Payment Failed', {
          Status: paymentIntent.status,
          'Organization ID': organization.id,
          'Organization Name': organization.name,
          'Repository ID': repository.id,
          'Repository Name': repository.name,
          'Issue ID': issue.id,
          'Issue Number': issue.number,
        })
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

    posthog.capture('Pledge Form Submitted', {
      'Organization ID': organization.id,
      'Organization Name': organization.name,
      'Repository ID': repository.id,
      'Repository Name': repository.name,
      'Issue ID': issue.id,
      'Issue Number': issue.number,
    })

    setSyncing(true)
    setErrorMessage('')

    const res = paymentMethod
      ? submitWithExistingPaymentMethod()
      : submitWithStripeElement()

    return await res
      .then(({ paymentIntent, error }) => {
        if (!paymentIntent) {
          posthog.capture('Pledge Payment Failed', {
            'Organization ID': organization.id,
            'Organization Name': organization.name,
            'Repository ID': repository.id,
            'Repository Name': repository.name,
            'Issue ID': issue.id,
            'Issue Number': issue.number,
          })

          if (error && error.message) {
            throw new Error(error.message)
          } else {
            throw new Error('No Payment Intent Created')
          }
        }
        handlePayment(paymentIntent)
      })
      .catch((error) => {
        setErrorMessage(error.message)
      })
      .finally(() => setSyncing(false))
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
                Save payment method on file
              </label>
            </div>
          </div>
        )}

      <div>
        <Button
          size="lg"
          disabled={!canSubmit}
          loading={isSyncing}
          onClick={onSubmit}
          fullWidth
        >
          Fund this issue
        </Button>
      </div>
    </div>
  )
}

export default PaymentForm
