'use client'

import type { AddressInput } from '@polar-sh/sdk/models/components/addressinput'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import { AlreadyActiveSubscriptionError } from '@polar-sh/sdk/models/errors/alreadyactivesubscriptionerror.js'
import { HTTPValidationError } from '@polar-sh/sdk/models/errors/httpvalidationerror'
import { NotOpenCheckout } from '@polar-sh/sdk/models/errors/notopencheckout.js'
import { PaymentError } from '@polar-sh/sdk/models/errors/paymenterror.js'
import { PaymentNotReady } from '@polar-sh/sdk/models/errors/paymentnotready.js'
import { TrialAlreadyRedeemed } from '@polar-sh/sdk/models/errors/trialalreadyredeemed'
import type {
  ConfirmationToken,
  Stripe,
  StripeElements,
  StripeError,
} from '@stripe/stripe-js'
import { createContext, useCallback, useContext, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { setValidationErrors } from '../utils/form'
import { useCheckout } from './CheckoutProvider'

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <CheckoutFormProvider>.',
  )
}

export interface CheckoutFormContextProps {
  checkout: CheckoutPublic
  form: UseFormReturn<CheckoutUpdatePublic>
  update: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  confirm: (
    data: CheckoutConfirmStripe,
    stripe: Stripe | null,
    elements: StripeElements | null,
  ) => Promise<CheckoutPublicConfirmed>
  loading: boolean
  loadingLabel: string | undefined
  isUpdatePending: boolean
}

// @ts-ignore
export const CheckoutFormContext = createContext<CheckoutFormContextProps>(stub)

export const CheckoutFormProvider = ({ children }: React.PropsWithChildren) => {
  const { checkout, update: updateOuter, confirm: confirmOuter } = useCheckout()
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState<string | undefined>()
  const [isUpdatePending, setIsUpdatePending] = useState(false)

  const form = useForm<CheckoutUpdatePublic>({
    defaultValues: {
      ...checkout,
      customerBillingAddress:
        checkout.customerBillingAddress as AddressInput | null,
      discountCode: checkout.discount ? checkout.discount.code : undefined,
      allowTrial: undefined,
    },
    shouldUnregister: true,
  })
  const { setError } = form

  const update = useCallback(
    async (
      checkoutUpdatePublic: CheckoutUpdatePublic,
    ): Promise<CheckoutPublic> => {
      setIsUpdatePending(true)
      const { ok, value, error } = await updateOuter(
        checkoutUpdatePublic,
      ).finally(() => {
        setIsUpdatePending(false)
      })
      if (ok) {
        return value
      } else {
        if (error instanceof HTTPValidationError) {
          setValidationErrors(error.detail || [], setError)
        } else if (
          error instanceof AlreadyActiveSubscriptionError ||
          error instanceof NotOpenCheckout ||
          error instanceof PaymentError ||
          error instanceof PaymentNotReady
        ) {
          setError('root', { message: error.detail })
        }
        throw error
      }
    },
    [updateOuter, setError],
  )

  const _confirm = useCallback(
    async (
      checkoutConfirmStripe: CheckoutConfirmStripe,
    ): Promise<CheckoutPublicConfirmed> => {
      const { ok, value, error } = await confirmOuter(checkoutConfirmStripe)
      if (ok) {
        return value
      }
      if (error instanceof HTTPValidationError) {
        setValidationErrors(error.detail || [], setError)
      } else if (
        error instanceof AlreadyActiveSubscriptionError ||
        error instanceof NotOpenCheckout ||
        error instanceof PaymentError ||
        error instanceof PaymentNotReady ||
        error instanceof TrialAlreadyRedeemed
      ) {
        setError('root', { message: error.detail })
        if (error instanceof TrialAlreadyRedeemed) {
          await update({ allowTrial: false })
        }
      }
      throw error
    },
    [confirmOuter, setError],
  )

  const confirm = useCallback(
    async (
      data: CheckoutConfirmStripe,
      stripe: Stripe | null,
      elements: StripeElements | null,
    ): Promise<CheckoutPublicConfirmed> => {
      setLoading(true)

      if (!checkout.isPaymentFormRequired) {
        setLoadingLabel('Processing order...')
        try {
          const checkoutConfirmed = await _confirm(data)
          return checkoutConfirmed
        } catch (e) {
          throw e
        } finally {
          setLoading(false)
        }
      }

      if (!stripe || !elements) {
        setLoading(false)
        throw new Error('Stripe elements not provided')
      }

      setLoadingLabel('Processing payment')

      const { error: submitError } = await elements.submit()
      if (submitError) {
        // Don't show validation errors, as they are already shown in their form
        if (submitError.type !== 'validation_error') {
          setError('root', { message: submitError.message })
        }
        setLoading(false)
        throw new Error(submitError.message)
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
                name: data.customerName,
                email: data.customerEmail,
                address: {
                  line1: data.customerBillingAddress?.line1 || null,
                  line2: data.customerBillingAddress?.line2 || null,
                  postal_code: data.customerBillingAddress?.postalCode || null,
                  city: data.customerBillingAddress?.city || null,
                  state: data.customerBillingAddress?.state || null,
                  country: data.customerBillingAddress?.country || null,
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
        throw err
      }

      if (!confirmationToken || error) {
        setError('root', {
          message:
            error?.message ||
            'Failed to create confirmation token, please try again later.',
        })
        setLoading(false)
        throw new Error(
          'Failed to create confirmation token, please try again later.',
        )
      }

      let updatedCheckout: CheckoutPublicConfirmed
      try {
        updatedCheckout = await _confirm({
          ...data,
          confirmationTokenId: confirmationToken.id,
        })
      } catch (e) {
        setLoading(false)
        throw e
      }

      setLoadingLabel('Payment successful! Getting your products ready...')

      const { intent_status, intent_client_secret } =
        updatedCheckout.paymentProcessorMetadata as Record<string, string>

      if (intent_status === 'requires_action') {
        const { error } = await stripe.handleNextAction({
          clientSecret: intent_client_secret,
        })
        if (error) {
          setLoading(false)
          setError('root', { message: error.message })
          throw new Error(error.message)
        }
      }

      setLoading(false)
      return updatedCheckout
    },
    [checkout, setError, _confirm],
  )

  return (
    <CheckoutFormContext.Provider
      value={{
        checkout,
        form,
        update,
        confirm,
        loading,
        loadingLabel,
        isUpdatePending,
      }}
    >
      {children}
    </CheckoutFormContext.Provider>
  )
}

export const useCheckoutForm = () => {
  return useContext(CheckoutFormContext)
}
