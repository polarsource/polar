import { OrganizationRead } from 'polarkit/api/client'
import { useState, type MouseEvent } from 'react'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'

import { PrimaryButton } from 'polarkit/components/ui'
import {
  useOrganizationCreateIntent,
  useOrganizationCustomer,
} from 'polarkit/hooks'
import PaymentMethodForm from './PaymentMethodForm'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

const PaymentSettings = ({ org }: { org: OrganizationRead }) => {
  const customerData = useOrganizationCustomer(org?.name)
  const customer = customerData.data

  const [errorMessage, setErrorMessage] = useState(null)
  const [isSyncing, setSyncing] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [showStripeElements, setShowStripeElements] = useState(false)

  const createIntent = useOrganizationCreateIntent()
  const createSetupIntent = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    createIntent.mutate(
      { orgName: org?.name },
      {
        onSuccess: () => {
          setIsDone(false)
          setShowStripeElements(true)
        },
      },
    )
  }

  const onSuccess = () => {
    setIsDone(true)
    setShowStripeElements(false)
  }

  return (
    <div className="space-y-2 text-black/80">
      {customer && customer.default_payment_method && (
        <>
          {customer.default_payment_method.type === 'card' && (
            <div>
              Using your saved{' '}
              {capitalizeFirstLetter(
                customer.default_payment_method.card_brand,
              )}{' '}
              card ending with{' '}
              <span className="font-mono">
                {customer.default_payment_method.card_last4}
              </span>{' '}
              for future pledges.
            </div>
          )}
          {customer.default_payment_method.type !== 'card' && (
            <div>
              Using your saved {customer.default_payment_method.type} for future
              pledges.
            </div>
          )}

          {!showStripeElements && (
            <PrimaryButton
              onClick={createSetupIntent}
              loading={createIntent.isLoading}
            >
              Change default payment method
            </PrimaryButton>
          )}
        </>
      )}

      {customer && !customer.default_payment_method && (
        <>
          <div>You have no saved payment methods</div>

          {!showStripeElements && (
            <PrimaryButton
              onClick={createSetupIntent}
              loading={createIntent.isLoading}
            >
              Add default payment method
            </PrimaryButton>
          )}
        </>
      )}

      {isDone && <div>Payment method saved!</div>}

      {showStripeElements && (
        <>
          <h2 className="text-md font-medium">Add a new payment method</h2>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: createIntent.data.client_secret,
            }}
          >
            <PaymentMethodForm
              organization={org}
              isSyncing={isSyncing}
              setSyncing={setSyncing}
              setErrorMessage={setErrorMessage}
              onSuccess={onSuccess}
            />
          </Elements>
        </>
      )}

      {errorMessage && <div>{errorMessage}</div>}
    </div>
  )
}

export default PaymentSettings
