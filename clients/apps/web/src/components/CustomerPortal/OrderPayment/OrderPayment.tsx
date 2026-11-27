'use client'

import revalidate from '@/app/actions'
import { toast } from '@/components/Toast/use-toast'
import {
  invalidatePaidOrder,
  useCustomerPaymentMethods,
  useCustomerPortalCustomer,
} from '@/hooks/queries/customerPortal'
import { loadPolarStripe } from '@/utils/stripe'
import { type Client, type schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { Elements } from '@stripe/react-stripe-js'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PortalText } from '../PortalPrimitives'
import { OrderPaymentForm } from './OrderPaymentForm'
import { OrderPaymentCard } from './OrderPaymentCard'
import { OrderPaymentSummary } from './OrderPaymentSummary'

export const OrderPayment = ({
  api,
  order: initialOrder,
  doneHref,
}: {
  api: Client
  order: schemas['CustomerOrder']
  doneHref: string
}) => {
  const router = useRouter()
  const theme = useTheme()
  const themingPreset = getThemePreset(theme.resolvedTheme as 'light' | 'dark')
  const [stripePromise] = useState(() => loadPolarStripe())

  const [order, setOrder] = useState(initialOrder)

  const { data: customer } = useCustomerPortalCustomer()
  const { data: paymentMethods } = useCustomerPaymentMethods(api)

  // A draft order reactivates an ended trial. A pending one is an unpaid renewal.
  const isDraft = initialOrder.status === 'draft'

  const handleSucceeded = async () => {
    invalidatePaidOrder()
    await revalidate('customer_portal')
    toast(
      isDraft
        ? {
            title: 'Subscription reactivated',
            description: 'Your subscription is active again.',
          }
        : {
            title: 'Payment successful',
            description: 'Your order has been paid.',
          },
    )
    router.push(doneHref)
  }

  if (order.status !== 'draft' && order.status !== 'pending') {
    return (
      <OrderPaymentCard alignItems="center" textAlign="center" rowGap="xs">
        <Box as="span" color="text-primary">
          Nothing to pay
        </Box>
        <PortalText tone="secondary" className="text-sm">
          This order doesn&apos;t need to be paid.
        </PortalText>
        <Box marginTop="l">
          <Link href={doneHref}>
            <Button variant="secondary">Back to customer portal</Button>
          </Link>
        </Box>
      </OrderPaymentCard>
    )
  }

  const savedCards = (paymentMethods?.items ?? []).filter(
    (pm): pm is schemas['PaymentMethodCard'] | schemas['PaymentMethodKrCard'] =>
      pm.type === 'card' || (pm.type === 'kr_card' && order.currency === 'krw'),
  )

  return (
    <Box flexDirection="column" rowGap="xl">
      <OrderPaymentSummary order={order} />
      {customer && paymentMethods && (
        <Elements
          stripe={stripePromise}
          options={{
            locale: 'en',
            ...(order.is_payment_required
              ? { mode: 'payment', amount: order.due_amount }
              : { mode: 'setup' }),
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
          <OrderPaymentForm
            api={api}
            order={order}
            customer={customer}
            savedCards={savedCards}
            onOrderUpdated={setOrder}
            onSucceeded={handleSucceeded}
          />
        </Elements>
      )}
    </Box>
  )
}
