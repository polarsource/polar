'use client'

import { useState } from 'react'
import { PaymentElement } from '@stripe/react-stripe-js'
import { 
  Stripe, 
  StripeElements, 
  ConfirmationToken, 
  StripeError 
} from '@stripe/stripe-js'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)

    // Follow the same pattern as AddPaymentMethodModal
    const { error: submitError } = await elements.submit()

    if (submitError) {
      if (submitError.message) {
        onError(submitError.message)
      }
      setIsProcessing(false)
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
      setIsProcessing(false)
      onError('Failed to process payment, please try again later.')
      return
    }

    if (!confirmationToken || error) {
      setIsProcessing(false)
      onError('Failed to process payment, please try again later.')
      return
    }

    // Send confirmation token to backend for processing
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
        
        if (result.status === 'succeeded') {
          onSuccess()
        } else if (result.status === 'requires_action') {
          // Handle 3DS or other authentication required
          if (result.client_secret) {
            // Use handleNextAction to minimize redirects
            const { error } = await stripe.handleNextAction({
              clientSecret: result.client_secret,
            })
            
            if (error) {
              onError(error.message || 'Payment authentication failed')
            } else {
              // Authentication completed, now poll for webhook result
              pollForWebhookResult()
            }
          } else {
            onError('Payment requires additional authentication')
          }
        } else {
          onError(result.error || 'Payment failed, please try again.')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        onError(errorData.detail || 'Payment failed, please try again.')
      }
    } catch (err) {
      onError('Payment failed, please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Poll for webhook result after authentication
  const pollForWebhookResult = () => {
    setIsPolling(true)
    
    const checkInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/orders/${order.id}/payment-status`,
          {
            headers: {
              Authorization: `Bearer ${customerSessionToken}`,
            },
          }
        )
        
        if (response.ok) {
          const status = await response.json()
          
          if (status.status === 'succeeded' || status.status === 'paid') {
            clearInterval(checkInterval)
            setIsPolling(false)
            onSuccess()
          } else if (status.status === 'failed') {
            clearInterval(checkInterval)
            setIsPolling(false)
            onError(status.error || 'Payment failed')
          }
          // Keep polling if status is still processing/pending
        }
      } catch (err) {
        console.error('Error checking payment status:', err)
      }
    }, 2000) // Check every 2 seconds
    
    // Stop polling after 2 minutes
    setTimeout(() => {
      clearInterval(checkInterval)
      setIsPolling(false)
      onError('Payment confirmation timed out. Please check your order status.')
    }, 120000)
  }

  return (
    <div className="space-y-4">
      {/* Order Summary */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Order Summary</h3>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>Product:</span>
            <span>{order.product.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount:</span>
            <span>${(order.total_amount / 100).toFixed(2)} {order.currency.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Payment Form or Processing State */}
      {isPolling ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mb-4" role="status">
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
          </div>
          <p className="text-lg font-medium">Processing your payment...</p>
          <p className="text-sm text-gray-500 mt-2">
            This may take a few moments. Please don't close this window.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Payment Method
            </label>
            <div className="border rounded-lg p-3">
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
            loading={isProcessing}
            disabled={!stripe || !elements || isProcessing}
            className="w-full"
          >
            {isProcessing ? 'Processing...' : 'Pay Now'}
          </Button>
        </form>
      )}
    </div>
  )
}