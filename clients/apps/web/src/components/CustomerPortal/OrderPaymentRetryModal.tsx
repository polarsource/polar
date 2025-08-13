'use client'

import { toast } from '@/components/Toast/use-toast'
import { useRetryPayment } from '@/hooks/useRetryPayment'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Modal, ModalHeader } from '../Modal'
import { Elements, ElementsConsumer } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useEffect, useMemo, useState } from 'react'
import { OrderPaymentRetry } from './OrderPaymentRetry'

// Will initialize Stripe with useMemo like AddPaymentMethodModal

interface OrderPaymentRetryModalProps {
  order: schemas['CustomerOrder']
  customerSessionToken: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: (order: schemas['CustomerOrder']) => void
}

export const OrderPaymentRetryModal = ({
  order,
  customerSessionToken,
  isOpen,
  onClose,
  onSuccess,
}: OrderPaymentRetryModalProps) => {
  const [clientSecret, setClientSecret] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string>('')

  const { createPaymentIntent } = useRetryPayment(customerSessionToken)

  // Initialize Stripe like AddPaymentMethodModal
  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_KEY
    if (!key) {
      console.error('NEXT_PUBLIC_STRIPE_KEY is not set')
      return null
    }
    return loadStripe(key)
  }, [])

  // Initialize payment intent when modal opens
  useEffect(() => {
    if (!isOpen || clientSecret || isInitializing) return

    console.log(
      'Initializing payment for order:',
      isOpen,
      order.id,
      clientSecret,
      isInitializing,
    )
    const initializePayment = async () => {
      setIsInitializing(true)
      setError('')

      try {
        const result = await createPaymentIntent(order.id)
        if (result?.client_secret) {
          setClientSecret(result.client_secret)
        } else {
          setError('Failed to initialize payment')
        }
      } catch (err) {
        console.error('Payment initialization error:', err)
        setError('Failed to initialize payment')
      } finally {
        setIsInitializing(false)
      }
    }

    initializePayment()
  }, [isOpen, order.id]) // Removed clientSecret from dependencies

  // Elements options - for payment intent mode
  const elementsOptions = useMemo(
    () => {
      if (!clientSecret) return undefined
      return {
        clientSecret,
        appearance: {
          theme: 'stripe' as const,
        },
      }
    },
    [clientSecret],
  )

  const handleClose = () => {
    setClientSecret('')
    setError('')
    setIsInitializing(false)
    onClose()
  }

  const handlePaymentSuccess = () => {
    toast({
      title: 'Payment Successful',
      description: 'Your payment has been processed successfully!',
    })
    onSuccess?.(order)
    handleClose()
  }

  const handlePaymentError = (error: string) => {
    setError(error)
    toast({
      title: 'Payment Failed',
      description: error,
      variant: 'error',
    })
  }

  if (!isOpen) return null

  return (
    <Modal
      isShown={isOpen}
      hide={handleClose}
      modalContent={
        <>
          <ModalHeader hide={handleClose}>
            <h3 className="text-lg font-semibold">Update Payment Method</h3>
          </ModalHeader>
          <div className="p-6 space-y-4">
            {/* Loading State */}
            {isInitializing && (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <span className="ml-2">Initializing payment...</span>
              </div>
            )}

            {/* Error State */}
            {error && !isInitializing && (
              <div className="py-8 text-center">
                <p className="mb-4 text-red-600">{error}</p>
                <Button
                  onClick={() => {
                    setError('')
                    setClientSecret('')
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Payment Form */}
            {clientSecret && !isInitializing && !error && elementsOptions && stripePromise && (
              <Elements 
                key={clientSecret} 
                stripe={stripePromise} 
                options={elementsOptions}
              >
                <ElementsConsumer>
                  {({ stripe, elements }) => (
                    <OrderPaymentRetry
                      order={order}
                      stripe={stripe}
                      elements={elements}
                      customerSessionToken={customerSessionToken}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  )}
                </ElementsConsumer>
              </Elements>
            )}

            {/* Stripe Configuration Error */}
            {clientSecret && !stripePromise && (
              <div className="py-8 text-center">
                <p className="mb-4 text-red-600">Stripe is not properly configured.</p>
              </div>
            )}
          </div>
        </>
      }
    />
  )
}
