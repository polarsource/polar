'use client'

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { SetupIntent, StripePaymentElementChangeEvent } from '@stripe/stripe-js'
import { useRouter } from 'next/router'
import { OrganizationPrivateRead } from 'polarkit/api/client'
import { PrimaryButton } from 'polarkit/components/ui'
import { useOrganizationSetDefaultPaymentMethod } from 'polarkit/hooks'
import { useState } from 'react'

const PaymentMethodForm = ({
  organization,
  isSyncing,
  setSyncing,
  setErrorMessage,
  onSuccess,
}: {
  organization: OrganizationPrivateRead
  isSyncing: boolean
  setSyncing: (isLocked: boolean) => void
  setErrorMessage: (message: string) => void
  onSuccess: () => void
}) => {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()

  const [isStripeCompleted, setStripeCompleted] = useState(false)
  const canSubmit = isStripeCompleted

  const generateRedirectURL = () => {
    const statusURL = new URL(window.location.href)
    return statusURL.toString()
  }

  const setDefaultPaymentMethod = useOrganizationSetDefaultPaymentMethod()
  const makeDefaultPaymentMethod = (setupIntent: SetupIntent) => {
    if (
      setupIntent.payment_method &&
      typeof setupIntent.payment_method === 'string'
    ) {
      setDefaultPaymentMethod.mutate(
        {
          orgName: organization?.name,
          paymentMethodId: setupIntent.payment_method,
        },
        {
          onSuccess: () => {
            onSuccess()
          },
        },
      )
    }
  }

  const handleConfirmation = (setupIntent: SetupIntent) => {
    switch (setupIntent.status) {
      case 'succeeded':
      case 'processing':
        makeDefaultPaymentMethod(setupIntent)
        break

      case 'requires_payment_method':
        setErrorMessage('Setup failed. Please try another payment method.')
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

    setSyncing(true)
    setErrorMessage('')

    return await stripe
      .confirmSetup({
        //`Elements` instance that was used to create the Payment Element
        elements,
        confirmParams: {
          return_url: generateRedirectURL(),
        },
        redirect: 'if_required',
      })
      .then(({ setupIntent, error }) => {
        if (error) {
          throw error
        }
        if (setupIntent) {
          handleConfirmation(setupIntent)
        }
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
    <div className="mt-4">
      <PaymentElement onChange={onStripeFormChange} />

      <div className="mt-4">
        <PrimaryButton
          disabled={!canSubmit}
          loading={isSyncing}
          onClick={onSubmit}
        >
          Save
        </PrimaryButton>
      </div>
    </div>
  )
}
export default PaymentMethodForm
