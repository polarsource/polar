import { OrganizationPrivateRead } from 'polarkit/api/client'
import { useState, type MouseEvent } from 'react'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'

import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { PrimaryButton } from 'polarkit/components/ui'
import {
  useOrganizationCreateIntent,
  useOrganizationCustomer,
} from 'polarkit/hooks'
import PaymentMethodForm from './PaymentMethodForm'
import SettingsInput from './SettingsInput'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

export type Settings = {
  billing_email?: string
}

const PaymentSettings = ({
  org,
  onUpdated,
  settings,
}: {
  org: OrganizationPrivateRead
  settings: Settings
  onUpdated: (s: Settings) => void
}) => {
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

  const onBillingEmailChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const billing_email = e.target.value

    onUpdated({
      billing_email,
    })
  }

  if (!settings) {
    return <></>
  }

  return (
    <div className="space-y-4 text-black/80">
      <div className="space-y-2 text-sm">
        <div className="inline-flex items-center space-x-4 text-sm leading-6 ">
          <span className="font-medium text-gray-900">Payment method</span>{' '}
          <span className="inline-flex items-center space-x-1 text-gray-500">
            <InformationCircleIcon className="h-6 w-6" />
            <span>Can be used by all members of this organization.</span>
          </span>
        </div>

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
                Using your saved {customer.default_payment_method.type} for
                future pledges.
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

      <SettingsInput
        id="billing_email"
        title="Billing email"
        description="Receipts will be sent to this address"
        onChange={onBillingEmailChanged}
        type="email"
        placeholder="billing@example.com"
        value={settings.billing_email}
      />
    </div>
  )
}

export default PaymentSettings
