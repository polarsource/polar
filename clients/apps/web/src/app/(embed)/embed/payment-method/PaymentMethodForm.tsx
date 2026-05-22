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

interface Props {
  api: Client
  themePreset: ThemingPresetProps
  setAsDefault: boolean
  customerBillingDetails: CustomerBillingDetails
  onProcessingStart?: () => void
  onProcessingError?: () => void
  onPaymentMethodAdded?: (
    paymentMethod: schemas['CustomerPaymentMethod'],
  ) => void
  redirectStatus?: string
  setupIntentId?: string
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
  onProcessingError,
  onPaymentMethodAdded,
  redirectStatus,
  setupIntentId,
}: Props) => {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || ''),
    [],
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!redirectStatus)

  const reportError = useCallback(
    (message: string) => {
      setError(message)
      setLoading(false)
      onProcessingError?.()
    },
    [onProcessingError],
  )

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
        reportError(FALLBACK_ERROR)
        return
      }

      if (confirmed.status === 'succeeded') {
        setLoading(false)
        onPaymentMethodAdded?.(confirmed.payment_method)
      } else {
        reportError(FALLBACK_ERROR)
      }
    },
    [api, onPaymentMethodAdded, reportError, setAsDefault],
  )

  // 3DS re-entry: if Stripe redirected the customer back with setup intent
  // params, confirm the intent server-side and strip the params from the
  // URL so a refresh doesn't re-confirm.
  const reentryConfirmedRef = useRef(false)
  const router = useRouter()
  useEffect(() => {
    if (!redirectStatus || reentryConfirmedRef.current) return
    reentryConfirmedRef.current = true
    ;(async () => {
      if (redirectStatus === 'failed' || !setupIntentId) {
        reportError(FALLBACK_ERROR)
      } else {
        await confirmSetupIntent(setupIntentId)
      }
      const search = new URLSearchParams(window.location.search)
      search.delete('redirect_status')
      search.delete('polar_setup_intent')
      router.replace(`${window.location.pathname}?${search.toString()}`)
    })()
  }, [redirectStatus, setupIntentId, confirmSetupIntent, reportError, router])

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
        reportError(submitError.message ?? FALLBACK_ERROR)
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
        reportError(tokenError?.message ?? FALLBACK_ERROR)
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
        reportError(FALLBACK_ERROR)
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
        reportError(actionError?.message ?? FALLBACK_ERROR)
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
      reportError,
      setAsDefault,
    ],
  )

  if (redirectStatus) {
    return (
      <div
        className="flex flex-col items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900 dark:border-gray-700 dark:border-t-white" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Adding payment method…
        </p>
      </div>
    )
  }

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
