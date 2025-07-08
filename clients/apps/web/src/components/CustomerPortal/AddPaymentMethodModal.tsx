import { useAddCustomerPaymentMethod } from '@/hooks/queries'
import { type Client } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import {
  Elements,
  ElementsConsumer,
  PaymentElement,
} from '@stripe/react-stripe-js'
import {
  loadStripe,
  type ConfirmationToken,
  type Stripe,
  type StripeElements,
  type StripeError,
} from '@stripe/stripe-js'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface AddPaymentMethodModalProps {
  api: Client
  onPaymentMethodAdded: () => void
  hide: () => void
  themingPreset: ThemingPresetProps
}

export const AddPaymentMethodModal = ({
  api,
  onPaymentMethodAdded,
  hide,
  themingPreset,
}: AddPaymentMethodModalProps) => {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || ''),
    [],
  )
  const addPaymentMethod = useAddCustomerPaymentMethod(api)
  const [error, setError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
    stripe: Stripe | null,
    elements: StripeElements | null,
  ) => {
    event.preventDefault()
    if (!stripe || !elements) {
      return
    }

    setError(null)
    setLoading(true)
    const { error: submitError } = await elements.submit()

    if (submitError) {
      if (submitError.message) {
        setError(submitError.message)
      }
      setLoading(false)
      return
    }

    let confirmationToken: ConfirmationToken | undefined
    let error: StripeError | undefined
    try {
      const confirmationTokenResponse = await stripe.createConfirmationToken({
        elements,
        params: {
          payment_method_data: {
            // Stripe requires fields to be explicitly set to null if they are not provided
            billing_details: {
              name: null,
              email: null,
              address: {
                line1: null,
                line2: null,
                postal_code: null,
                city: null,
                state: null,
                country: null,
              },
              phone: null,
            },
          },
        },
      })
      confirmationToken = confirmationTokenResponse.confirmationToken
      error = confirmationTokenResponse.error
    } catch (err) {
      setLoading(false)
      setError('Failed to add payment method, please try again later.')
      return
    }

    if (!confirmationToken || error) {
      setLoading(false)
      setError('Failed to add payment method, please try again later.')
      return
    }

    const { error: validationError } = await addPaymentMethod.mutateAsync({
      confirmation_token_id: confirmationToken.id,
      set_default: true,
      return_url: window.location.href,
    })

    if (validationError) {
      setError('Failed to add payment method, please try again later.')
      setLoading(false)
      return
    }

    setLoading(false)
    onPaymentMethodAdded()
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <h3 className="text-xl">Add Payment Method</h3>
      <Elements
        stripe={stripePromise}
        options={{
          mode: 'setup',
          paymentMethodCreation: 'manual',
          setupFutureUsage: 'off_session',
          currency: 'usd',
          appearance: themingPreset.stripe,
        }}
      >
        <ElementsConsumer>
          {({ stripe, elements }) => (
            <form
              onSubmit={(e) => handleSubmit(e, stripe, elements)}
              className="flex flex-col gap-6"
            >
              <PaymentElement
                options={{
                  layout: 'tabs',
                  fields: {
                    billingDetails: {
                      name: 'never',
                      email: 'never',
                      phone: 'never',
                      address: 'never',
                    },
                  },
                }}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex flex-row items-center gap-2">
                <Button
                  type="submit"
                  className={twMerge('self-start', themingPreset.polar.button)}
                  disabled={!stripe || loading}
                  loading={loading}
                >
                  Add payment method
                </Button>
                <Button
                  variant="ghost"
                  onClick={hide}
                  className={themingPreset.polar.buttonSecondary}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </ElementsConsumer>
      </Elements>
    </div>
  )
}
