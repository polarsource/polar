import { useAddCustomerPaymentMethod } from '@/hooks/queries'
import { type Client } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
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
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'

const AddPaymentMethod = ({
  api,
  onPaymentMethodAdded,
}: {
  api: Client
  onPaymentMethodAdded: () => void
}) => {
  const { resolvedTheme: theme } = useTheme()
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || ''),
    [],
  )
  const addPaymentMethod = useAddCustomerPaymentMethod(api)
  const [error, setError] = useState<string | null>(null)

  const inputBoxShadow =
    theme === 'dark'
      ? 'none'
      : 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'
  const focusBoxShadow =
    theme === 'dark'
      ? 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 71, 184, 0.4) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'
      : 'rgb(255, 255, 255) 0px 0px 0px 0px, rgb(204, 224, 255) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'

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
    <Elements
      stripe={stripePromise}
      options={{
        mode: 'setup',
        paymentMethodCreation: 'manual',
        setupFutureUsage: 'off_session',
        currency: 'usd',
        appearance: {
          theme: theme === 'dark' ? 'night' : 'stripe',
          rules: {
            '.Label': {
              color: theme === 'dark' ? 'white' : 'black',
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '8px',
            },
            '.PickerItem': {
              padding: '12px',
              backgroundColor: theme === 'dark' ? 'rgb(28 28 34)' : 'white',
              color: theme === 'dark' ? '#E5E5E1' : '#181A1F',
              borderRadius: '9999px',
              boxShadow: inputBoxShadow,
              borderColor: 'transparent',
            },
            '.PickerItem--selected': {
              backgroundColor: theme === 'dark' ? 'rgb(28 28 34)' : 'white',
              borderColor: '#0062FF',
              borderWidth: '2px',
            },
            '.PickerItem--selected:hover': {
              backgroundColor: theme === 'dark' ? 'rgb(28 28 34)' : 'white',
            },
            '.Input': {
              padding: '12px',
              backgroundColor:
                theme === 'dark' ? 'rgb(26.4, 26.8, 29.7)' : 'white',
              color: theme === 'dark' ? '#E5E5E1' : '#181A1F',
              borderRadius: '9999px',
              borderColor: theme === 'dark' ? 'rgb(36, 36.5, 40.5)' : '#EEE',
              boxShadow: inputBoxShadow,
            },
            '.Input:focus': {
              borderColor:
                theme === 'dark' ? 'rgb(0, 84, 219)' : 'rgb(102, 161, 255)',
              boxShadow: focusBoxShadow,
            },
            '.Tab': {
              backgroundColor:
                theme === 'dark' ? 'rgb(26.4, 26.8, 29.7)' : 'white',
              borderColor: theme === 'dark' ? 'rgb(36, 36.5, 40.5)' : '#EEE',
            },
            '.Tab--selected': {
              backgroundColor: 'rgb(51, 129, 255)',
              boxShadow: focusBoxShadow,
              border: 'none',
            },
            '.Tab:focus': {
              boxShadow: focusBoxShadow,
            },
            '.TabLabel--selected': {
              color: 'white',
            },
            '.TabIcon--selected': {
              fill: 'white',
            },
            '.Block': {
              backgroundColor: 'transparent',
              borderColor: theme === 'dark' ? '#353641' : '#EEE',
            },
          },
          variables: {
            borderRadius: '8px',
            fontSizeBase: '0.875rem',
            spacingGridRow: '18px',
            colorDanger: theme === 'dark' ? '#F17878' : '#E64D4D',
          },
        },
      }}
    >
      <ElementsConsumer>
        {({ stripe, elements }) => (
          <form
            onSubmit={(e) => handleSubmit(e, stripe, elements)}
            className="flex flex-col gap-4"
          >
            <PaymentElement
              options={{
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
            <Button
              type="submit"
              disabled={!stripe || loading}
              loading={loading}
            >
              Add payment method
            </Button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </form>
        )}
      </ElementsConsumer>
    </Elements>
  )
}

export default AddPaymentMethod
