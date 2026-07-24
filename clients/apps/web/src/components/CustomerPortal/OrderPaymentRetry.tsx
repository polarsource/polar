'use client'

import {
  useCustomerOrderConfirmPayment,
  useCustomerOrderPaymentStatus,
} from '@/hooks/queries/customerPortal'
import { type Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PaymentElement } from '@stripe/react-stripe-js'
import {
  ConfirmationToken,
  Stripe,
  StripeElements,
  StripeError,
} from '@stripe/stripe-js'
import { Check as CheckIcon, WalletCards, X as XIcon } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

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

const TONE_STYLES = {
  success: { background: 'background-success', color: 'success' },
  danger: { background: 'background-danger', color: 'danger' },
  accent: { background: 'background-accent', color: 'accent' },
} as const

const StatusPanel = ({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: ReactNode
  tone: keyof typeof TONE_STYLES
  title: string
  description: string
  children?: ReactNode
}) => (
  <Box
    flexDirection="column"
    alignItems="center"
    rowGap="l"
    paddingVertical="2xl"
  >
    <Box
      width={64}
      height={64}
      borderRadius="full"
      alignItems="center"
      justifyContent="center"
      backgroundColor={TONE_STYLES[tone].background}
      color={`text-${TONE_STYLES[tone].color}`}
    >
      {icon}
    </Box>
    <Box flexDirection="column" alignItems="center" rowGap="xs">
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text color="muted" align="center">
        {description}
      </Text>
    </Box>
    {children && (
      <Box alignItems="center" columnGap="s">
        {children}
      </Box>
    )}
  </Box>
)

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
  const hasInitiatedPaymentRef = useRef(false)

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
    hasInitiatedPaymentRef.current = false
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
    async (result: schemas['CustomerOrderPaymentConfirmation']) => {
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
    async (result: schemas['CustomerOrderPaymentConfirmation']) => {
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
      } catch {
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
    } catch {
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
  // Use ref for synchronous guard to prevent double-calls in React Strict Mode
  useEffect(() => {
    if (
      paymentMethodId &&
      !hasInitiatedPaymentRef.current &&
      !isProcessing &&
      !isPolling
    ) {
      hasInitiatedPaymentRef.current = true
      setHasSubmitted(true)
      handleSavedPaymentMethod()
    }
  }, [paymentMethodId, isProcessing, isPolling, handleSavedPaymentMethod])

  return (
    <Box flexDirection="column" rowGap="l">
      {/* Order Summary */}
      <Box
        flexDirection="column"
        rowGap="s"
        borderRadius="s"
        backgroundColor="background-secondary"
        padding="l"
      >
        <Text variant="title" as="h3">
          Order summary
        </Text>
        <Box flexDirection="column" rowGap="xs">
          <Box justifyContent="between" columnGap="l">
            <Text color="muted">Description</Text>
            <Text as="span">{order.description}</Text>
          </Box>
          <Box justifyContent="between" columnGap="l">
            <Text color="muted">Amount</Text>
            <Text as="span" tabularNums>
              {formatCurrency('accounting')(order.total_amount, order.currency)}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Payment Form or Processing State */}
      {paymentComplete ? (
        <StatusPanel
          icon={showRetryButton ? <XIcon size={32} /> : <CheckIcon size={32} />}
          tone={showRetryButton ? 'danger' : 'success'}
          title={showRetryButton ? 'Payment failed' : 'Payment successful'}
          description={
            showRetryButton
              ? 'You can try again or contact support if the issue persists.'
              : 'Thank you for your payment. You can now close this window.'
          }
        >
          {showRetryButton && (
            <Button onClick={resetProcessingStates} variant="default">
              Try again
            </Button>
          )}
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </StatusPanel>
      ) : isPolling ? (
        <StatusPanel
          icon={<Spinner />}
          tone="accent"
          title="Processing your payment…"
          description="This may take a few moments. Please don't close this window."
        />
      ) : paymentMethodId ? (
        <StatusPanel
          icon={<WalletCards size={32} />}
          tone="accent"
          title="Processing payment…"
          description="Using your saved payment method"
        >
          {onBack && (
            <Button onClick={onBack} variant="secondary">
              Back
            </Button>
          )}
        </StatusPanel>
      ) : (
        <Box flexDirection="column" rowGap="l">
          <Box
            as="form"
            onSubmit={handleSubmit}
            flexDirection="column"
            rowGap="l"
          >
            <Box flexDirection="column" rowGap="s">
              <Text as="label" variant="title">
                Payment method
              </Text>
              <Box
                borderRadius="s"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
                padding="m"
                flexDirection="column"
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
              </Box>
            </Box>

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
              fullWidth
            >
              {isProcessing
                ? 'Processing…'
                : isPolling
                  ? 'Confirming…'
                  : 'Pay now'}
            </Button>
          </Box>
          {onBack && (
            <Button onClick={onBack} variant="secondary" fullWidth>
              Back
            </Button>
          )}
        </Box>
      )}
    </Box>
  )
}
