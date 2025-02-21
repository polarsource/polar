'use client'

import { useAuth } from '@/hooks/auth'
import { usePostHog } from '@/hooks/posthog'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import {
  PaymentIntent,
  StripePaymentElementChangeEvent,
} from '@stripe/stripe-js'
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
}: {
  paymentIntent?: schemas['PledgeStripePaymentIntentMutationResponse']
  issue: schemas['Issue']
  organization: schemas['Organization']
  repository: schemas['Repository']
  isSyncing: boolean
  setSyncing: (isLocked: boolean) => void
  setErrorMessage: (message: string) => void
  onSuccess: (paymentIntent: PaymentIntent) => void
  hasDetails: boolean
  redirectTo: string
}) => {
  const posthog = usePostHog()
  const stripe = useStripe()
  const elements = useElements()
  const { currentUser } = useAuth()

  const [isStripeCompleted, setStripeCompleted] = useState(false)

  const havePaymentMethod = isStripeCompleted

  const canSubmit =
    !isSyncing && paymentIntent && havePaymentMethod && hasDetails

  useEffect(() => {
    if (havePaymentMethod) {
      posthog.capture('storefront:issues:pledge_form:done', {
        organization_id: organization.id,
        organization_name: organization.slug,
        repository_id: repository.id,
        repository_name: repository.name,
        issue_id: issue.id,
        issue_number: issue.number,
      })
    }
  }, [
    posthog,
    havePaymentMethod,
    issue.id,
    issue.number,
    organization.id,
    organization.slug,
    repository.id,
    repository.name,
  ])

  const handlePayment = (paymentIntent: PaymentIntent) => {
    switch (paymentIntent.status) {
      case 'succeeded':
      case 'processing':
        posthog.capture('storefront:issues:pledge_payment:done', {
          status: paymentIntent.status,
          organization_id: organization.id,
          organization_name: organization.slug,
          repository_id: repository.id,
          repository_name: repository.name,
          issue_id: issue.id,
          issue_number: issue.number,
        })
        onSuccess(paymentIntent)
        break

      case 'requires_payment_method':
        posthog.capture('storefront:issues:pledge_payment:fail', {
          status: paymentIntent.status,
          organization_id: organization.id,
          organization_name: organization.slug,
          repository_id: repository.id,
          repository_name: repository.name,
          issue_id: issue.id,
          issue_number: issue.number,
        })
        setErrorMessage('Payment failed. Please try another payment method.')
        break

      default:
        posthog.capture('storefront:issues:pledge_payment:fail', {
          status: paymentIntent.status,
          organization_id: organization.id,
          organization_name: organization.slug,
          repository_id: repository.id,
          repository_name: repository.name,
          issue_id: issue.id,
          issue_number: issue.number,
        })
        setErrorMessage('Something went wrong.')
        break
    }
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

    posthog.capture('storefront:issues:pledge_form:submit', {
      organization_id: organization.id,
      organization_name: organization.slug,
      repository_id: repository.id,
      repository_name: repository.name,
      issue_id: issue.id,
      issue_number: issue.number,
    })

    setSyncing(true)
    setErrorMessage('')

    const res = submitWithStripeElement()

    return await res
      .then(({ paymentIntent, error }) => {
        if (!paymentIntent) {
          posthog.capture('storefront:issues:pledge_payment:fail', {
            organization_id: organization.id,
            organization_name: organization.slug,
            repository_id: repository.id,
            repository_name: repository.name,
            issue_id: issue.id,
            issue_number: issue.number,
          })

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
        setSyncing(false)
      })
  }

  const onStripeFormChange = (event: StripePaymentElementChangeEvent) => {
    setStripeCompleted(event.complete)
  }

  return (
    <div className="dark:border-polar-500 flex flex-col gap-4 border-t pt-5">
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

      <Subtotal paymentIntent={paymentIntent} />

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
