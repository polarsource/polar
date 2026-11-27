'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCustomerPaymentMethods } from '@/hooks/queries/customerPortal'
import { type Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, Button } from '@polar-sh/orbit'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { Elements, ElementsConsumer } from '@stripe/react-stripe-js'
import { Stripe } from '@stripe/stripe-js'
import { useEffect, useMemo, useState } from 'react'
import { loadPolarStripe } from '@/utils/stripe'
import { OrderPaymentRetry } from './OrderPaymentRetry'
import { PortalDialog } from './PortalDialog'
import { SavedCardsSelector } from './SavedCardsSelector'

interface OrderPaymentRetryModalProps {
  order: schemas['CustomerOrder']
  api: Client
  isOpen: boolean
  onClose: () => void
  onSuccess?: (order: schemas['CustomerOrder']) => void
  themingPreset: ThemingPresetProps
}

export const OrderPaymentRetryModal = ({
  order,
  api,
  isOpen,
  onClose,
  onSuccess,
  themingPreset,
}: OrderPaymentRetryModalProps) => {
  const [error, setError] = useState<string>('')
  const [useNewCard, setUseNewCard] = useState<boolean>(false)
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null)

  const { data: paymentMethodsData } = useCustomerPaymentMethods(api)
  const cardPaymentMethods = (paymentMethodsData?.items || []).filter(
    (pm): pm is schemas['PaymentMethodCard'] | schemas['PaymentMethodKrCard'] =>
      pm.type === 'card' || (pm.type === 'kr_card' && order.currency === 'krw'),
  )

  const stripePromise = useMemo(() => loadPolarStripe(), [])

  // Resolve Stripe instance for saved payment methods that may require 3DS authentication
  const [stripe, setStripe] = useState<Stripe | null>(null)
  useEffect(() => {
    stripePromise.then(setStripe)
  }, [stripePromise])

  const handleClose = () => {
    setError('')
    setUseNewCard(false)
    setSelectedPaymentMethodId(null)
    onClose()
  }

  const handlePaymentSuccess = () => {
    toast({
      title: 'Payment successful',
      description: 'Your payment has been processed successfully!',
    })
    onSuccess?.(order)
  }

  const handlePaymentError = (error: string) => {
    setError(error)
    // Reset selection on error so user can try again
    setUseNewCard(false)
    setSelectedPaymentMethodId(null)
    toast({
      title: 'Payment failed',
      description: error,
      variant: 'error',
    })
  }

  if (!isOpen) return null

  return (
    <PortalDialog
      isShown={isOpen}
      hide={handleClose}
      title="Retry payment"
      description={`${order.description} · ${formatCurrency('compact')(order.due_amount, order.currency)}`}
      actions={
        error ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
            <Button onClick={() => setError('')}>Try again</Button>
          </>
        ) : undefined
      }
    >
      {error && (
        <Alert variant="danger" title="Payment failed" description={error} />
      )}

      {/* Payment Method Selection or Payment Form */}
      {!error && (
        <>
          {!useNewCard && !selectedPaymentMethodId && (
            <SavedCardsSelector
              paymentMethods={cardPaymentMethods}
              onSelectPaymentMethod={setSelectedPaymentMethodId}
              onAddNewCard={() => setUseNewCard(true)}
            />
          )}

          {selectedPaymentMethodId && stripe && (
            <OrderPaymentRetry
              order={order}
              api={api}
              stripe={stripe}
              paymentMethodId={selectedPaymentMethodId}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              onClose={handleClose}
              onBack={() => setSelectedPaymentMethodId(null)}
            />
          )}

          {useNewCard && stripePromise && (
            <Elements
              stripe={stripePromise}
              options={{
                locale: 'en',
                mode: 'payment',
                amount: order.due_amount,
                currency: order.currency,
                setupFutureUsage: 'off_session',
                excludedPaymentMethodTypes: [
                  'bancontact',
                  'ideal',
                  'sepa_debit',
                  'sofort',
                ],
                paymentMethodCreation: 'manual',
                appearance: themingPreset.stripe,
              }}
            >
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
                    onBack={() => setUseNewCard(false)}
                  />
                )}
              </ElementsConsumer>
            </Elements>
          )}
        </>
      )}
    </PortalDialog>
  )
}
