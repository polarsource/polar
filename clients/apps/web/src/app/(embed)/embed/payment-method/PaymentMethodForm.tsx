'use client'

import { type Client, schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import {
  Elements,
  ElementsConsumer,
  PaymentElement,
} from '@stripe/react-stripe-js'
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface CustomerBillingDetails {
  name: string | null
  email: string | null
  address: schemas['Address'] | null
}

export interface SetupIntent {
  clientSecret: string
  id: string
}

interface Props {
  api: Client
  themePreset: ThemingPresetProps
  setAsDefault: boolean
  customerBillingDetails: CustomerBillingDetails
  onProcessingStart?: () => void
  onPaymentMethodAdded?: (
    paymentMethod: schemas['CustomerPaymentMethod'],
  ) => void
  setupIntent?: SetupIntent
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

const toStripeBillingDetails = (customer: CustomerBillingDetails) => ({
  name: customer.name,
  email: customer.email,
  phone: null,
  address: {
    line1: customer.address?.line1 ?? null,
    line2: customer.address?.line2 ?? null,
    postal_code: customer.address?.postal_code ?? null,
    city: customer.address?.city ?? null,
    state: customer.address?.state ?? null,
    country: customer.address?.country ?? null,
  },
})

export const PaymentMethodForm = ({
  api,
  themePreset,
  setAsDefault,
  customerBillingDetails,
  onProcessingStart,
  onPaymentMethodAdded,
  setupIntent,
}: Props) => {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || ''),
    [],
  )
  const [error, setError] = useState<string | null>(null)
  // Start loading if we're re-entering from a 3DS redirect — the confirm
  // call below will flip it back to false. Avoids a flash of the
  // submittable form before the in-flight confirm resolves.
  const [loading, setLoading] = useState(!!setupIntent)

  const confirmSetupIntent = useCallback(
    async (setupIntentId: string) => {
      let confirmed
      try {
        confirmed = await unwrap(
          api.POST('/v1/customer-portal/customers/me/payment-methods/confirm', {
            body: { setup_intent_id: setupIntentId, set_default: setAsDefault },
          }),
        )
      } catch {
        setError(FALLBACK_ERROR)
        setLoading(false)
        return
      }

      setLoading(false)
      if (confirmed.status === 'succeeded') {
        onPaymentMethodAdded?.(confirmed.payment_method)
      } else {
        setError(FALLBACK_ERROR)
      }
    },
    [api, onPaymentMethodAdded, setAsDefault],
  )

  // 3DS re-entry: if Stripe redirected the customer back with setup intent
  // params, confirm the intent server-side and strip the params from the
  // URL so a refresh doesn't re-confirm.
  const reentryConfirmedRef = useRef(false)
  const router = useRouter()
  useEffect(() => {
    if (!setupIntent || reentryConfirmedRef.current) return
    reentryConfirmedRef.current = true
    ;(async () => {
      await confirmSetupIntent(setupIntent.id)
      const search = new URLSearchParams(window.location.search)
      search.delete('setup_intent_client_secret')
      search.delete('setup_intent')
      router.replace(`${window.location.pathname}?${search.toString()}`)
    })()
  }, [setupIntent, confirmSetupIntent, router])

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
        setError(submitError.message ?? FALLBACK_ERROR)
        setLoading(false)
        return
      }

      const { confirmationToken, error: tokenError } =
        await stripe.createConfirmationToken({
          elements,
          params: {
            payment_method_data: {
              billing_details: toStripeBillingDetails(customerBillingDetails),
            },
          },
        })

      if (tokenError || !confirmationToken) {
        setError(tokenError?.message ?? FALLBACK_ERROR)
        setLoading(false)
        return
      }

      onProcessingStart?.()

      let created
      try {
        created = await unwrap(
          api.POST('/v1/customer-portal/customers/me/payment-methods', {
            body: {
              confirmation_token_id: confirmationToken.id,
              set_default: setAsDefault,
              return_url: window.location.href,
            },
          }),
        )
      } catch {
        setError(FALLBACK_ERROR)
        setLoading(false)
        return
      }

      if (created.status === 'succeeded') {
        setLoading(false)
        onPaymentMethodAdded?.(created.payment_method)
        return
      }

      const { error: actionError, setupIntent: nextActionIntent } =
        await stripe.handleNextAction({ clientSecret: created.client_secret })

      if (actionError || !nextActionIntent) {
        setError(actionError?.message ?? FALLBACK_ERROR)
        setLoading(false)
        return
      }

      await confirmSetupIntent(nextActionIntent.id)
    },
    [
      api,
      confirmSetupIntent,
      customerBillingDetails,
      onPaymentMethodAdded,
      onProcessingStart,
      setAsDefault,
    ],
  )

  return (
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
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="self-start"
              disabled={!stripe || loading}
              loading={loading}
            >
              Add payment method
            </Button>
          </form>
        )}
      </ElementsConsumer>
    </Elements>
  )
}
