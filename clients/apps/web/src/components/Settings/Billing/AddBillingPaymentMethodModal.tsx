'use client'

import {
  useAddOrganizationPaymentMethod,
  useConfirmOrganizationPaymentMethod,
} from '@/hooks/queries/billing'
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
import { useCallback, useMemo, useState } from 'react'

export interface AddBillingPaymentMethodModalProps {
  organizationId: string
  onPaymentMethodAdded: () => void
  hide: () => void
  themePreset: ThemingPresetProps
}

export const AddBillingPaymentMethodModal = ({
  organizationId,
  onPaymentMethodAdded,
  hide,
  themePreset,
}: AddBillingPaymentMethodModalProps) => {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || ''),
    [],
  )
  const addPaymentMethod = useAddOrganizationPaymentMethod(organizationId)
  const confirmPaymentMethod =
    useConfirmOrganizationPaymentMethod(organizationId)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const confirm = useCallback(
    async (setupIntentId: string) => {
      const { error: validationError } = await confirmPaymentMethod.mutateAsync(
        {
          setup_intent_id: setupIntentId,
          set_default: true,
        },
      )

      if (validationError) {
        setError(
          validationError.detail ??
            'Failed to add payment method, please try again later.',
        )
        setLoading(false)
        return
      }

      setLoading(false)
      onPaymentMethodAdded()
    },
    [confirmPaymentMethod, onPaymentMethodAdded],
  )

  const handleSubmit = useCallback(
    async (
      event: React.FormEvent<HTMLFormElement>,
      stripe: Stripe | null,
      elements: StripeElements | null,
    ) => {
      event.preventDefault()
      if (!stripe || !elements) return

      setError(null)
      setLoading(true)
      const { error: submitError } = await elements.submit()

      if (submitError) {
        if (submitError.message) setError(submitError.message)
        setLoading(false)
        return
      }

      let confirmationToken: ConfirmationToken | undefined
      let tokenError: StripeError | undefined
      try {
        const response = await stripe.createConfirmationToken({
          elements,
          params: {
            payment_method_data: {
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
        confirmationToken = response.confirmationToken
        tokenError = response.error
      } catch {
        setLoading(false)
        setError('Failed to add payment method, please try again later.')
        return
      }

      if (!confirmationToken || tokenError) {
        setLoading(false)
        setError('Failed to add payment method, please try again later.')
        return
      }

      const { error: validationError, data } =
        await addPaymentMethod.mutateAsync({
          confirmation_token_id: confirmationToken.id,
          set_default: true,
          return_url: window.location.href,
        })

      if (validationError || !data) {
        setError(
          validationError?.detail ??
            'Failed to add payment method, please try again later.',
        )
        setLoading(false)
        return
      }

      if (data.status === 'requires_action') {
        const { error: actionError, setupIntent } =
          await stripe.handleNextAction({ clientSecret: data.client_secret })
        if (actionError || !setupIntent) {
          setError(
            (actionError && actionError.message) ||
              'Failed to handle next action.',
          )
          setLoading(false)
          return
        }
        await confirm(setupIntent.id)
      } else {
        setLoading(false)
        onPaymentMethodAdded()
      }
    },
    [addPaymentMethod, confirm, onPaymentMethodAdded],
  )

  return (
    <div className="flex flex-col gap-6 p-8">
      <Elements
        stripe={stripePromise}
        options={{
          locale: 'en',
          mode: 'setup',
          paymentMethodCreation: 'manual',
          setupFutureUsage: 'off_session',
          currency: 'usd',
          appearance: themePreset.stripe,
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
                  className="self-start"
                  disabled={!stripe || loading}
                  loading={loading}
                >
                  Add payment method
                </Button>
                <Button variant="ghost" type="button" onClick={hide}>
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
