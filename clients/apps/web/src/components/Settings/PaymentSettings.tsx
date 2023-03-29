import { OrganizationRead } from 'polarkit/api/client'
import { useState, type MouseEvent } from 'react'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'

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

  const createIntent = useOrganizationCreateIntent()
  const createSetupIntent = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    createIntent.mutate({ orgName: org?.name })
  }

  const [errorMessage, setErrorMessage] = useState(null)
  const [isSyncing, setSyncing] = useState(false)

  return (
    <div>
      {customer && customer.default_payment_method && (
        <>
          {customer.default_payment_method.type === 'card' && (
            <div>
              Using your saved{' '}
              {capitalizeFirstLetter(
                customer.default_payment_method.card_brand,
              )}{' '}
              card ending with {customer.default_payment_method.card_last4} for
              future payments.
            </div>
          )}
          {customer.default_payment_method.type !== 'card' && (
            <div>
              Using your saved {customer.default_payment_method.type} for future
              payments.
            </div>
          )}

          <button
            onClick={createSetupIntent}
            className="cursor-pointer rounded-md bg-green-200 p-2 hover:bg-green-100"
          >
            Add new payment method
          </button>
        </>
      )}

      {customer && !customer.default_payment_method && (
        <>
          <div>You have no saved payment method</div>
          <button
            onClick={createSetupIntent}
            className="cursor-pointer rounded-md bg-green-200 p-2 hover:bg-green-100"
          >
            Add default payment method
          </button>
        </>
      )}

      {createIntent.data && (
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
          />
        </Elements>
      )}

      {errorMessage && <div>{errorMessage}</div>}
    </div>
  )
}

export default PaymentSettings
