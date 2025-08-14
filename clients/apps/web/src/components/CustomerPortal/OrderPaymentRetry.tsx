'use client'

import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { PaymentElement } from '@stripe/react-stripe-js'
import {
  ConfirmationToken,
  Stripe,
  StripeElements,
  StripeError,
} from '@stripe/stripe-js'
import { useEffect, useRef, useState } from 'react'

interface OrderPaymentRetryProps {
  order: schemas['CustomerOrder']
  stripe: Stripe | null
  elements: StripeElements | null
  customerSessionToken: string
  onSuccess: () => void
  onError: (error: string) => void
}

export const OrderPaymentRetry = ({
  order,
  stripe,
  elements,
  customerSessionToken,
  onSuccess,
  onError,
}: OrderPaymentRetryProps) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [showRetryButton, setShowRetryButton] = useState(false)

  // Ref to track active polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Helper to clean up polling interval
  const cleanupPolling = () => {
    if (pollingIntervalRef.current) {
      console.log('Cleaning up polling interval', { orderId: order.id })
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  // Helper to reset all processing states
  const resetProcessingStates = () => {
    setIsProcessing(false)
    setIsPolling(false)
    setHasSubmitted(false)
    setPaymentComplete(false)
    setShowRetryButton(false)
    cleanupPolling()
  }

  // Helper to handle payment completion (success or failure)
  const handlePaymentCompletion = (success: boolean, message?: string) => {
    setIsProcessing(false)
    setIsPolling(false)
    setPaymentComplete(true)

    if (success) {
      // Don't reset hasSubmitted - wait for user confirmation
      onSuccess()
    } else {
      setShowRetryButton(true)
      if (message) {
        onError(message)
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPolling()
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Prevent duplicate submissions
    if (isProcessing || isPolling || hasSubmitted) {
      console.log('Payment submission blocked - already processing', {
        orderId: order.id,
        isProcessing,
        isPolling,
        hasSubmitted,
      })
      return
    }

    if (!stripe || !elements) {
      console.error('Stripe not initialized', { orderId: order.id })
      return
    }

    console.log('Starting payment retry', {
      orderId: order.id,
      amount: order.total_amount,
      currency: order.currency,
    })

    setIsProcessing(true)
    setHasSubmitted(true)

    // Follow the same pattern as AddPaymentMethodModal
    const { error: submitError } = await elements.submit()

    if (submitError) {
      const errorMessage =
        submitError.message ||
        'Failed to process payment details. Please check your information and try again.'
      handlePaymentCompletion(false, errorMessage)
      return
    }

    // Create confirmation token like AddPaymentMethodModal
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

    // Send confirmation token to backend for processing
    console.log('Sending confirmation token to backend', {
      orderId: order.id,
      confirmationTokenId: confirmationToken.id,
    })

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/orders/${order.id}/confirm-payment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${customerSessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            confirmation_token_id: confirmationToken.id,
          }),
        },
      )

      if (response.ok) {
        const result = await response.json()
        console.log('Backend response received', {
          orderId: order.id,
          status: result.status,
        })

        if (result.status === 'succeeded') {
          console.log('Payment succeeded immediately', { orderId: order.id })
          handlePaymentCompletion(true)
        } else if (result.status === 'requires_action') {
          console.log('Payment requires additional action', {
            orderId: order.id,
          })
          // Handle 3DS or other authentication required
          if (result.client_secret) {
            // Use handleNextAction to minimize redirects
            const { error } = await stripe.handleNextAction({
              clientSecret: result.client_secret,
            })

            if (error) {
              handlePaymentCompletion(
                false,
                error.message || 'Payment authentication failed',
              )
            } else {
              // Authentication completed, now poll for webhook result
              pollForWebhookResult()
            }
          } else {
            handlePaymentCompletion(
              false,
              'Payment requires additional authentication',
            )
          }
        } else {
          handlePaymentCompletion(
            false,
            result.error || 'Payment failed, please try again.',
          )
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          errorData.detail ||
          (response.status === 409
            ? 'Another payment is already in progress. Please wait and try again.'
            : 'Payment failed. Please try again.')
        handlePaymentCompletion(false, errorMessage)
      }
    } catch (err) {
      console.error('Payment request failed:', err)
      handlePaymentCompletion(
        false,
        'Network error occurred. Please check your connection and try again.',
      )
    }
  }

  // Poll for webhook result after authentication
  const pollForWebhookResult = () => {
    console.log('Starting webhook result polling', { orderId: order.id })
    setIsPolling(true)
    let attemptCount = 0
    const maxAttempts = 150 // 5 minutes at 2-second intervals

    // Clear any existing interval
    cleanupPolling()

    pollingIntervalRef.current = setInterval(async () => {
      attemptCount++

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/orders/${order.id}/payment-status`,
          {
            headers: {
              Authorization: `Bearer ${customerSessionToken}`,
            },
          },
        )

        if (response.ok) {
          const status = await response.json()

          if (status.status === 'succeeded' || status.status === 'paid') {
            cleanupPolling()
            handlePaymentCompletion(true)
            return
          } else if (status.status === 'failed') {
            cleanupPolling()
            handlePaymentCompletion(false, status.error || 'Payment failed')
            return
          }
          // Keep polling if status is still processing/pending
        } else if (response.status >= 500) {
          // Server error - continue polling but log it
          console.warn(
            `Server error during status check (attempt ${attemptCount}):`,
            response.status,
          )
        }

        // Stop polling after max attempts
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
          // 1 minute for network errors
          cleanupPolling()
          handlePaymentCompletion(
            false,
            'Unable to confirm payment status due to network issues. ' +
              'Please check your order status or contact support.',
          )
        }
      }
    }, 2000) // Check every 2 seconds
  }

  return (
    <div className="space-y-4">
      {/* Order Summary */}
      <div className="rounded-lg bg-gray-50 p-4">
        <h3 className="mb-2 font-medium">Order Summary</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Product:</span>
            <span>{order.product.name}</span>
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
            <p className="mt-2 text-sm text-gray-500">
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
          <Button onClick={() => window.close()} variant="outline">
            Close
          </Button>
        </div>
      ) : isPolling ? (
        <div className="py-8 text-center">
          <div
            className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
            role="status"
          >
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
              Loading...
            </span>
          </div>
          <p className="text-lg font-medium">Processing your payment...</p>
          <p className="mt-2 text-sm text-gray-500">
            This may take a few moments. Please don&apos;t close this window.
          </p>
        </div>
      ) : (
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
              !stripe || !elements || isProcessing || isPolling || hasSubmitted
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
      )}
    </div>
  )
}
