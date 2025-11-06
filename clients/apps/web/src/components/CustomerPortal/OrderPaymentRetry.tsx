'use client'

import {
  useCustomerOrderConfirmPayment,
  useCustomerOrderPaymentStatus,
} from '@/hooks/queries'
import { type Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { PaymentElement } from '@stripe/react-stripe-js'
import {
  ConfirmationToken,
  Stripe,
  StripeElements,
  StripeError,
} from '@stripe/stripe-js'
import { WalletCards } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface OrderPaymentRetryProps {
  order: schemas['CustomerOrder']
  stripe?: Stripe | null
  elements?: StripeElements | null
  api: Client
  paymentMethodId?: string
  onSuccess: () => void
  onError: (error: string) => void
  onClose: () => void
  onBack?: () => void
}

export const OrderPaymentRetry = ({
  order,
  stripe,
  elements,
  api,
  paymentMethodId,
  onSuccess,
  onError,
  onClose,
  onBack,
}: OrderPaymentRetryProps) => {
  const confirmOrderPayment = useCustomerOrderConfirmPayment(api)
  const checkPaymentStatus = useCustomerOrderPaymentStatus(api)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [showRetryButton, setShowRetryButton] = useState(false)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const cleanupPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  const resetProcessingStates = () => {
    setIsProcessing(false)
    setIsPolling(false)
    setHasSubmitted(false)
    setPaymentComplete(false)
    setShowRetryButton(false)
    cleanupPolling()
  }

  const handlePaymentCompletion = useCallback(
    (success: boolean, message?: string) => {
      setIsProcessing(false)
      setIsPolling(false)
      setPaymentComplete(true)

      if (success) {
        onSuccess()
      } else {
        setShowRetryButton(true)
        if (message) {
          onError(message)
        }
      }
    },
    [onSuccess, onError],
  )

  const pollForWebhookResult = useCallback(() => {
    setIsPolling(true)
    let attemptCount = 0
    const maxAttempts = 150 // 5 minutes at 2-second intervals

    cleanupPolling()

    pollingIntervalRef.current = setInterval(async () => {
      attemptCount++

      try {
        const { data: status, error: statusError } =
          await checkPaymentStatus.mutateAsync({
            orderId: order.id,
          })

        if (!statusError && status) {
          if (status.status === 'succeeded') {
            cleanupPolling()
            handlePaymentCompletion(true)
            return
          } else if (status.status === 'failed') {
            cleanupPolling()
            handlePaymentCompletion(false, status.error || 'Payment failed')
            return
          }
        } else if (statusError) {
          console.warn(
            `Server error during status check (attempt ${attemptCount}):`,
            statusError,
          )
        }

        if (attemptCount >= maxAttempts) {
          cleanupPolling()
          handlePaymentCompletion(
            false,
            'Payment confirmation is taking longer than expected. ' +
              'Your payment may still be processing. Please check your order status or contact support if needed.',
          )
        }
      } catch (err) {
        console.error(
          `Error checking payment status (attempt ${attemptCount}):`,
          err,
        )

        // On network errors, stop after fewer attempts
        if (attemptCount >= 30) {
          cleanupPolling()
          handlePaymentCompletion(
            false,
            'Unable to confirm payment status due to network issues. ' +
              'Please check your order status or contact support.',
          )
        }
      }
    }, 2000) // Check every 2 seconds
  }, [checkPaymentStatus, order.id, handlePaymentCompletion])

  const handlePaymentAction = useCallback(
    async (result: any) => {
      if (!stripe) {
        handlePaymentCompletion(
          false,
          'Stripe instance is required for payment actions',
        )
        return
      }

      if (!result.client_secret) {
        handlePaymentCompletion(
          false,
          'Payment requires additional authentication',
        )
        return
      }

      const { error } = await stripe.handleNextAction({
        clientSecret: result.client_secret,
      })

      if (error) {
        handlePaymentCompletion(
          false,
          error.message || 'Payment authentication failed',
        )
      } else {
        pollForWebhookResult()
      }
    },
    [stripe, handlePaymentCompletion, pollForWebhookResult],
  )

  const handlePaymentStatus = useCallback(
    async (result: any) => {
      switch (result.status) {
        case 'succeeded':
          handlePaymentCompletion(true)
          break

        case 'requires_action':
          await handlePaymentAction(result)
          break

        default:
          handlePaymentCompletion(
            false,
            result.error || 'Payment failed, please try again.',
          )
      }
    },
    [handlePaymentCompletion, handlePaymentAction],
  )

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (isProcessing || isPolling || hasSubmitted) {
        return
      }

      if (!stripe || !elements) {
        return
      }

      setIsProcessing(true)
      setHasSubmitted(true)

      const { error: submitError } = await elements.submit()

      if (submitError) {
        const errorMessage =
          submitError.message ||
          'Failed to process payment details. Please check your information and try again.'
        handlePaymentCompletion(false, errorMessage)
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
        console.error('Failed to create confirmation token:', {
          orderId: order.id,
          error: err,
        })
        handlePaymentCompletion(
          false,
          'Failed to create payment token. Please try again.',
        )
        return
      }

      if (!confirmationToken || error) {
        const errorMessage =
          error?.message ||
          'Failed to process payment. Please check your payment information and try again.'
        handlePaymentCompletion(false, errorMessage)
        return
      }

      try {
        const { data: result, error: confirmPaymentError } =
          await confirmOrderPayment.mutateAsync({
            orderId: order.id,
            confirmation_token_id: confirmationToken.id,
          })

        if (confirmPaymentError) {
          const errorMessage =
            confirmPaymentError.detail || 'Payment failed. Please try again.'
          handlePaymentCompletion(false, errorMessage)
          return
        }

        if (result) {
          await handlePaymentStatus(result)
        }
      } catch (err) {
        handlePaymentCompletion(
          false,
          'Network error occurred. Please check your connection and try again.',
        )
      }
    },
    [
      isProcessing,
      isPolling,
      hasSubmitted,
      stripe,
      elements,
      order.id,
      confirmOrderPayment,
      handlePaymentCompletion,
      handlePaymentStatus,
    ],
  )

  const handleSavedPaymentMethod = useCallback(async () => {
    if (isProcessing || isPolling || !paymentMethodId) {
      return
    }

    setIsProcessing(true)

    try {
      const { data: result, error: confirmPaymentError } =
        await confirmOrderPayment.mutateAsync({
          orderId: order.id,
          payment_method_id: paymentMethodId,
        })

      if (confirmPaymentError) {
        const errorMessage =
          confirmPaymentError.detail || 'Payment failed. Please try again.'
        handlePaymentCompletion(false, errorMessage)
        return
      }

      if (result) {
        await handlePaymentStatus(result)
      }
    } catch (err) {
      handlePaymentCompletion(
        false,
        'Network error occurred. Please check your connection and try again.',
      )
    }
  }, [
    isProcessing,
    isPolling,
    paymentMethodId,
    confirmOrderPayment,
    order.id,
    handlePaymentCompletion,
    handlePaymentStatus,
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPolling()
    }
  }, [])

  // Auto-trigger payment for saved payment methods
  useEffect(() => {
    if (paymentMethodId && !hasSubmitted && !isProcessing && !isPolling) {
      setHasSubmitted(true)
      handleSavedPaymentMethod()
    }
  }, [
    paymentMethodId,
    hasSubmitted,
    isProcessing,
    isPolling,
    handleSavedPaymentMethod,
  ])

  return (
    <div className="space-y-4">
      {/* Order Summary */}
      <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-4">
        <h3 className="mb-2 font-medium">Order Summary</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Description:</span>
            <span>{order.description}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount:</span>
            <span>
              ${(order.total_amount / 100).toFixed(2)}{' '}
              {order.currency.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Form or Processing State */}
      {paymentComplete ? (
        <div className="py-8 text-center">
          <div className="mb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-lg font-medium">
              {showRetryButton ? 'Payment Failed' : 'Payment Successful!'}
            </p>
            <p className="dark:text-polar-500 mt-2 text-sm text-gray-500">
              {showRetryButton
                ? 'You can try again or contact support if the issue persists.'
                : 'Thank you for your payment. You can now close this window.'}
            </p>
          </div>
          {showRetryButton && (
            <Button
              onClick={resetProcessingStates}
              variant="default"
              className="mr-2"
            >
              Try Again
            </Button>
          )}
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      ) : isPolling ? (
        <div className="py-8 text-center">
          <div
            className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
            role="status"
          >
            <span className="!absolute -m-px! h-px! w-px! overflow-hidden! border-0! p-0! whitespace-nowrap! [clip:rect(0,0,0,0)]!">
              Loading...
            </span>
          </div>
          <p className="text-lg font-medium">Processing your payment...</p>
          <p className="mt-2 text-sm text-gray-500">
            This may take a few moments. Please don&apos;t close this window.
          </p>
        </div>
      ) : paymentMethodId ? (
        // Using saved payment method
        <div className="py-8 text-center">
          <div className="mb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <WalletCards className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-lg font-medium">Processing payment...</p>
            <p className="mt-2 text-sm text-gray-500">
              Using your saved payment method
            </p>
          </div>
          {onBack && (
            <Button onClick={onBack} variant="outline">
              Back
            </Button>
          )}
        </div>
      ) : (
        // New payment method form
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Payment Method
              </label>
              <div className="rounded-lg border p-3">
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
              </div>
            </div>

            <Button
              type="submit"
              loading={isProcessing || isPolling}
              disabled={
                !stripe ||
                !elements ||
                isProcessing ||
                isPolling ||
                hasSubmitted
              }
              className="w-full"
            >
              {isProcessing
                ? 'Processing...'
                : isPolling
                  ? 'Confirming...'
                  : 'Pay Now'}
            </Button>
          </form>
          {onBack && (
            <Button onClick={onBack} variant="outline" className="w-full">
              Back
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
