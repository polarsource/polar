'use client'

import { toast } from '@/components/Toast/use-toast'
import { type Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Elements, ElementsConsumer } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useMemo, useState } from 'react'
import { Modal, ModalHeader } from '../Modal'
import { OrderPaymentRetry } from './OrderPaymentRetry'

interface OrderPaymentRetryModalProps {
  order: schemas['CustomerOrder']
  api: Client
  isOpen: boolean
  onClose: () => void
  onSuccess?: (order: schemas['CustomerOrder']) => void
}

export const OrderPaymentRetryModal = ({
  order,
  api,
  isOpen,
  onClose,
  onSuccess,
}: OrderPaymentRetryModalProps) => {
  const [error, setError] = useState<string>('')

  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_KEY
    if (!key) {
      console.error('NEXT_PUBLIC_STRIPE_KEY is not set')
      return null
    }
    return loadStripe(key)
  }, [])

  const elementsOptions = useMemo(() => {
    return {
      mode: 'payment' as const,
      amount: order.total_amount,
      currency: order.currency,
      appearance: {
        theme: 'stripe' as const,
      },
    }
  }, [order.total_amount, order.currency])

  const handleClose = () => {
    setError('')
    onClose()
  }

  const handlePaymentSuccess = () => {
    toast({
      title: 'Payment Successful',
      description: 'Your payment has been processed successfully!',
    })
    onSuccess?.(order)
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
          <div className="space-y-4 p-6">
            {/* Error State */}
            {error && (
              <div className="py-4 text-center">
                <p className="mb-4 text-red-600">{error}</p>
                <Button
                  onClick={() => {
                    setError('')
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Payment Form */}
            {!error && stripePromise && (
              <Elements stripe={stripePromise} options={elementsOptions}>
                <ElementsConsumer>
                  {({ stripe, elements }) => (
                    <OrderPaymentRetry
                      order={order}
                      stripe={stripe}
                      elements={elements}
                      api={api}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      onClose={handleClose}
                    />
                  )}
                </ElementsConsumer>
              </Elements>
            )}
          </div>
        </>
      }
    />
  )
}
