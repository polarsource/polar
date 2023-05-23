import { OrganizationPrivateRead } from 'polarkit/api/client'
import { useState, type MouseEvent } from 'react'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'

import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { PrimaryButton, ThinButton } from 'polarkit/components/ui'
import {
  useOrganizationCreateIntent,
  useOrganizationCustomer,
} from 'polarkit/hooks'
import PaymentMethodForm from './PaymentMethodForm'
import SettingsInput from './SettingsInput'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

export type Settings = {
  billing_email?: string
}

const Highlight = (props: { children: React.ReactNode }) => {
  return (
    <span className="rounded-md bg-blue-100 py-0.5 px-1.5 font-mono text-gray-700">
      {props.children}
    </span>
  )
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

  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isSyncing, setSyncing] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [showStripeElements, setShowStripeElements] = useState(false)

  const createIntent = useOrganizationCreateIntent()
  const createSetupIntent = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setErrorMessage('')

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
    <div className="space-y-5 divide-y text-black/80">
      <div className="space-y-2 text-sm">
        <div className="inline-flex items-center space-x-3 text-sm leading-6 ">
          <span className="font-medium text-gray-900">Payment method</span>{' '}
          <span className="inline-flex items-center space-x-1 text-gray-500">
            <InformationCircleIcon className="h-5 w-5 text-gray-400" />
            <span>Can be used by all members of this organization.</span>
          </span>
        </div>

        {customer && customer.default_payment_method && (
          <div className="flex flex-row justify-between">
            {customer.default_payment_method.type === 'card' &&
              customer.default_payment_method.card_brand && (
                <div>
                  Using your saved{' '}
                  <Highlight>
                    {capitalizeFirstLetter(
                      customer.default_payment_method.card_brand,
                    )}
                  </Highlight>{' '}
                  card ending with{' '}
                  <Highlight>
                    {customer.default_payment_method.card_last4}
                  </Highlight>{' '}
                  for future pledges.
                </div>
              )}
            {customer.default_payment_method.type !== 'card' && (
              <div>
                Using your saved{' '}
                <Highlight>{customer.default_payment_method.type}</Highlight>{' '}
                for future pledges.
              </div>
            )}

            {!showStripeElements && (
              <ThinButton
                onClick={createSetupIntent}
                loading={createIntent.isLoading}
              >
                Change
              </ThinButton>
            )}
          </div>
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

        {showStripeElements && createIntent && createIntent.data && (
          <div className="!mt-5 border-t pt-5 pb-2">
            <h2 className="text-md font-medium">Add a new payment method</h2>
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: createIntent.data.client_secret,
                appearance: {
                  rules: {
                    '.Label': {
                      color: '#727374',
                      fontWeight: '500',
                      fontSize: '14px',
                      marginBottom: '8px',
                    },
                    '.Input': {
                      padding: '12px',
                    },
                    '.TermsText': {
                      fontSize: '14px',
                    },
                  },
                  variables: {
                    borderRadius: '8px',
                    fontFamily: '"Inter var", Inter, sans-serif',
                    fontSizeBase: '14px',
                    spacingGridRow: '18px',
                  },
                },
                fonts: [
                  {
                    cssSrc:
                      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500',
                  },
                ],
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
          </div>
        )}

        {errorMessage && <div>{errorMessage}</div>}
      </div>
      <div className="pt-5">
        <SettingsInput
          id="billing_email"
          title="Billing email"
          description="Receipts will be sent to this address"
          onChange={onBillingEmailChanged}
          type="email"
          placeholder="billing@example.com"
          value={settings.billing_email || ''}
        />
      </div>
    </div>
  )
}

export default PaymentSettings
