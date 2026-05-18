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

interface Props {
  api: Client
  themePreset: ThemingPresetProps
  onProcessingStart: () => void
  onPaymentMethodAdded: (
    paymentMethod: schemas['CustomerPaymentMethod'],
  ) => void
  /**
   * When the embed re-enters after Stripe's 3DS full-page redirect,
   * these are the params Stripe appends to the return URL. Presence
   * means: confirm the setup intent and clean the URL.
   */
  setupIntentParams?: {
    setup_intent_client_secret: string
    setup_intent: string
  }
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

export const PaymentMethodForm = ({
  api,
  themePreset,
  onProcessingStart,
  onPaymentMethodAdded,
  setupIntentParams,
}: Props) => {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || ''),
    [],
  )
  const [error, setError] = useState<string | null>(null)
  // Start loading if we're re-entering from a 3DS redirect — the confirm
  // call below will flip it back to false. Avoids a flash of the
  // submittable form before the in-flight confirm resolves.
  const [loading, setLoading] = useState(!!setupIntentParams)

  const confirmSetupIntent = useCallback(
    async (setupIntentId: string) => {
      let confirmed
      try {
        confirmed = await unwrap(
          api.POST('/v1/customer-portal/customers/me/payment-methods/confirm', {
            body: { setup_intent_id: setupIntentId, set_default: true },
          }),
        )
      } catch {
        setError(FALLBACK_ERROR)
        setLoading(false)
        return
      }

      setLoading(false)
      if (confirmed.status === 'succeeded') {
        onPaymentMethodAdded(confirmed.payment_method)
      } else {
        setError(FALLBACK_ERROR)
      }
    },
    [api, onPaymentMethodAdded],
  )

  // 3DS re-entry: if Stripe redirected the customer back with setup intent
  // params, confirm the intent server-side and strip the params from the
  // URL so a refresh doesn't re-confirm.
  const reentryConfirmedRef = useRef(false)
  const router = useRouter()
  useEffect(() => {
    if (!setupIntentParams || reentryConfirmedRef.current) return
    reentryConfirmedRef.current = true
    ;(async () => {
      await confirmSetupIntent(setupIntentParams.setup_intent)
      const search = new URLSearchParams(window.location.search)
      search.delete('setup_intent_client_secret')
      search.delete('setup_intent')
      router.replace(`${window.location.pathname}?${search.toString()}`)
    })()
  }, [setupIntentParams, confirmSetupIntent, router])

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
              billing_details: {
                name: null,
                email: null,
                phone: null,
                address: {
                  line1: null,
                  line2: null,
                  postal_code: null,
                  city: null,
                  state: null,
                  country: null,
                },
              },
            },
          },
        })

      if (tokenError || !confirmationToken) {
        setError(tokenError?.message ?? FALLBACK_ERROR)
        setLoading(false)
        return
      }

      onProcessingStart()

      let created
      try {
        created = await unwrap(
          api.POST('/v1/customer-portal/customers/me/payment-methods', {
            body: {
              confirmation_token_id: confirmationToken.id,
              set_default: true,
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
        onPaymentMethodAdded(created.payment_method)
        return
      }

      const { error: actionError, setupIntent } = await stripe.handleNextAction(
        { clientSecret: created.client_secret },
      )

      if (actionError || !setupIntent) {
        setError(actionError?.message ?? FALLBACK_ERROR)
        setLoading(false)
        return
      }

      await confirmSetupIntent(setupIntent.id)
    },
    [api, confirmSetupIntent, onPaymentMethodAdded, onProcessingStart],
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
