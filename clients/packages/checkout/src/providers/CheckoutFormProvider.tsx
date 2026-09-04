'use client'

import type { schemas } from '@polar-sh/client'

import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import type {
  ConfirmationToken,
  Stripe,
  StripeElements,
  StripeError,
} from '@stripe/stripe-js'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { setValidationErrors } from '../utils/form'
import { useCheckout } from './CheckoutProvider'

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <CheckoutFormProvider>.',
  )
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export interface CheckoutFormContextProps {
  checkout: schemas['CheckoutPublic']
  form: UseFormReturn<schemas['CheckoutUpdatePublic']>
  update: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<schemas['CheckoutPublic']>
  confirm: (
    data: schemas['CheckoutConfirmStripe'],
    stripe: Stripe | null,
    elements: StripeElements | null,
  ) => Promise<schemas['CheckoutPublicConfirmed']>
  loading: boolean
  loadingLabel: string | undefined
  isUpdatePending: boolean
  trialUnavailable: boolean
}

// @ts-expect-error - Allow to throw an error if the context is used without a provider
export const CheckoutFormContext = createContext<CheckoutFormContextProps>(stub)

export const CheckoutFormProvider = ({
  children,
  locale = DEFAULT_LOCALE,
}: React.PropsWithChildren<{ locale?: AcceptedLocale }>) => {
  const { checkout, update: updateOuter, confirm: confirmOuter } = useCheckout()
  const t = useTranslations(locale)
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState<string | undefined>()
  const [isUpdatePending, setIsUpdatePending] = useState(false)
  const [trialUnavailable, setTrialUnavailable] = useState(false)

  const form = useForm<schemas['CheckoutUpdatePublic']>({
    defaultValues: {
      ...checkout,
      customer_billing_address: checkout.customer_billing_address as
        | schemas['AddressInput'] // We need to typecast here for some reason (it tries to match all_countries to supported_countries)
        | null,
      discount_code: checkout.discount ? checkout.discount.code : undefined,
      allow_trial: undefined,
    },
    shouldUnregister: true,
  })
  const { setError } = form

  const setDiscountError = useCallback(
    (message: string) => {
      const field =
        checkout.allow_discount_codes && checkout.is_discount_applicable
          ? 'discount_code'
          : 'root'
      setError(field, { message })
    },
    [checkout, setError],
  )

  const performUpdate = useCallback(
    async (
      checkoutUpdatePublic: schemas['CheckoutUpdatePublic'],
    ): Promise<schemas['CheckoutPublic']> => {
      const { ok, value, error } = await updateOuter(checkoutUpdatePublic)
      if (ok) {
        return value
      } else {
        if (error) {
          switch (error.error) {
            case 'PolarRequestValidationError':
            case 'RequestValidationError':
              setValidationErrors(error.detail, setError)
              break
            case 'DiscountRedemptionLimitReached':
              setDiscountError(error.detail)
              break
            case 'AlreadyActiveSubscriptionError':
            case 'NotOpenCheckout':
            case 'PaymentNotReady':
              setError('root', { message: error.detail })
              break
            case 'ResourceNotFound':
            case 'ExpiredCheckoutError':
              break
          }
        }
        throw error
      }
    },
    [updateOuter, setError, setDiscountError],
  )

  // Keep at most one checkout update PATCH in flight at a time. The backend
  // locks the checkout row with `FOR UPDATE NOWAIT` and returns a 409
  // (CheckoutLocked) if a second update overlaps the first, so we serialize
  // here. Calls made while a request is in flight are coalesced into a single
  // trailing request (last write wins per field) that flushes once the current
  // one settles; all coalesced callers resolve with that request's result.
  const inFlightRef = useRef(false)
  const pendingRef = useRef<{
    payload: schemas['CheckoutUpdatePublic']
    deferred: Deferred<schemas['CheckoutPublic']>
  } | null>(null)

  const pump = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) {
      return
    }
    const batch = pendingRef.current
    if (!batch) {
      setIsUpdatePending(false)
      return
    }
    pendingRef.current = null
    inFlightRef.current = true
    try {
      batch.deferred.resolve(await performUpdate(batch.payload))
    } catch (error) {
      batch.deferred.reject(error)
    } finally {
      inFlightRef.current = false
      void pump()
    }
  }, [performUpdate])

  const update = useCallback(
    (
      checkoutUpdatePublic: schemas['CheckoutUpdatePublic'],
    ): Promise<schemas['CheckoutPublic']> => {
      if (pendingRef.current) {
        pendingRef.current.payload = {
          ...pendingRef.current.payload,
          ...checkoutUpdatePublic,
        }
      } else {
        pendingRef.current = {
          payload: checkoutUpdatePublic,
          deferred: createDeferred<schemas['CheckoutPublic']>(),
        }
      }
      setIsUpdatePending(true)
      const { promise } = pendingRef.current.deferred
      void pump()
      return promise
    },
    [pump],
  )

  const _confirm = useCallback(
    async (
      checkoutConfirmStripe: schemas['CheckoutConfirmStripe'],
    ): Promise<schemas['CheckoutPublicConfirmed']> => {
      const { ok, value, error } = await confirmOuter(checkoutConfirmStripe)

      if (ok) {
        return value
      }

      if (error) {
        switch (error.error) {
          case 'PolarRequestValidationError':
          case 'RequestValidationError':
            setValidationErrors(error.detail, setError)
            break
          case 'PaymentError':
          case 'AlreadyActiveSubscriptionError':
          case 'NotOpenCheckout':
          case 'PaymentNotReady':
            setError('root', { message: error.detail })
            break
          case 'DiscountRedemptionLimitReached':
            setDiscountError(error.detail)
            break
          case 'TrialAlreadyRedeemed':
            setTrialUnavailable(true)
            await update({ allow_trial: false })
            break
          case 'ResourceNotFound':
          case 'ExpiredCheckoutError':
            break
        }
      }

      throw error
    },
    [confirmOuter, setError, setDiscountError, update, setTrialUnavailable],
  )

  const confirm = useCallback(
    async (
      data: schemas['CheckoutConfirmStripe'],
      stripe: Stripe | null,
      elements: StripeElements | null,
    ): Promise<schemas['CheckoutPublicConfirmed']> => {
      setLoading(true)
      setTrialUnavailable(false)

      if (!checkout.is_payment_form_required) {
        setLoadingLabel(t('checkout.loading.processingOrder'))
        try {
          const checkoutConfirmed = await _confirm(data)
          return checkoutConfirmed
        } finally {
          setLoading(false)
        }
      }

      if (!stripe || !elements) {
        setLoading(false)
        throw new Error('Stripe elements not provided')
      }

      setLoadingLabel(t('checkout.loading.processingPayment'))

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
                name: data.customer_name || null,
                email: data.customer_email,
                address: {
                  line1: data.customer_billing_address?.line1 || null,
                  line2: data.customer_billing_address?.line2 || null,
                  postal_code:
                    data.customer_billing_address?.postal_code || null,
                  city: data.customer_billing_address?.city || null,
                  state: data.customer_billing_address?.state || null,
                  country: data.customer_billing_address?.country || null,
                },
                phone: null,
              },
            },
          },
        })
        confirmationToken = confirmationTokenResponse.confirmationToken
        error = confirmationTokenResponse.error
      } catch (error) {
        setLoading(false)
        throw error
      }

      if (!confirmationToken || error) {
        const fallbackMessage = t('checkout.loading.confirmationTokenFailed')
        setError('root', {
          message: error?.message || fallbackMessage,
        })
        setLoading(false)
        throw new Error(error?.message || fallbackMessage)
      }

      let updatedCheckout: schemas['CheckoutPublicConfirmed']
      try {
        updatedCheckout = await _confirm({
          ...data,
          confirmation_token_id: confirmationToken.id,
        })
      } catch (error) {
        setLoading(false)
        throw error
      }

      setLoadingLabel(t('checkout.loading.paymentSuccessful'))

      const { intent_status, intent_client_secret } =
        updatedCheckout.payment_processor_metadata

      let currentIntentStatus = intent_status
      while (currentIntentStatus === 'requires_action') {
        const { error, paymentIntent, setupIntent } =
          await stripe.handleNextAction({
            clientSecret: intent_client_secret,
          })
        if (error) {
          setLoading(false)
          setError('root', { message: error.message })
          throw new Error(error.message)
        }
        currentIntentStatus =
          paymentIntent?.status || setupIntent?.status || intent_status
      }

      setLoading(false)
      return updatedCheckout
    },
    [checkout, setError, _confirm, t, setTrialUnavailable],
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
        trialUnavailable,
      }}
    >
      {children}
    </CheckoutFormContext.Provider>
  )
}

export const useCheckoutForm = () => {
  return useContext(CheckoutFormContext)
}
