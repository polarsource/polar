'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCustomerPaymentMethods } from '@/hooks/queries/customerPortal'
import { type Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { Elements, ElementsConsumer } from '@stripe/react-stripe-js'
import { Stripe } from '@stripe/stripe-js'
import { useEffect, useMemo, useState } from 'react'
import { loadPolarStripe } from '@/utils/stripe'
import { Modal } from '../Modal'
import { OrderPaymentRetry } from './OrderPaymentRetry'
import { usePortalTranslations } from './PortalLocaleProvider'
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
  const t = usePortalTranslations()
  const [error, setError] = useState<string>('')
  const [useNewCard, setUseNewCard] = useState<boolean>(false)
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null)

  const { data: paymentMethodsData } = useCustomerPaymentMethods(api)
  const cardPaymentMethods = (paymentMethodsData?.items || []).filter(
    (pm): pm is schemas['PaymentMethodCard'] => pm.type === 'card',
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
      title: t('portal.orders.payment.toastSuccessTitle'),
      description: t('portal.orders.payment.toastSuccessDescription'),
    })
    onSuccess?.(order)
  }

  const handlePaymentError = (error: string) => {
    setError(error)
    // Reset selection on error so user can try again
    setUseNewCard(false)
    setSelectedPaymentMethodId(null)
    toast({
      title: t('portal.orders.payment.toastFailedTitle'),
      description: error,
      variant: 'error',
    })
  }

  if (!isOpen) return null

  return (
    <Modal
      title={t('portal.orders.payment.updatePaymentMethod')}
      isShown={isOpen}
      hide={handleClose}
      modalContent={
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
                {t('portal.orders.payment.tryAgain')}
              </Button>
            </div>
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
        </div>
      }
    />
  )
}
