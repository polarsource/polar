'use client'

import { useCustomerOrderUpdate } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import { type Client, type schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, Button } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useElements, useStripe } from '@stripe/react-stripe-js'
import { useEffect, useState } from 'react'
import { useForm, useFormState } from 'react-hook-form'
import {
  type CustomerPortalCustomerUpdate,
  getBillingDetailsValues,
  hasCompleteBillingAddress,
} from '../BillingDetailsFields'
import { BillingDetailsCard } from './BillingDetailsCard'
import { PaymentMethodCard } from './PaymentMethodCard'
import { useReactivationPayment } from './useReactivationPayment'

type SavedCard = schemas['PaymentMethodCard'] | schemas['PaymentMethodKrCard']

const requiresPaymentMethod = (order: schemas['CustomerOrder']) =>
  order.is_payment_required || order.is_payment_setup_required

export const ReactivateSubscriptionForm = ({
  api,
  order,
  customer,
  savedCards,
  onOrderUpdated,
  onSucceeded,
}: {
  api: Client
  order: schemas['CustomerOrder']
  customer: schemas['CustomerPortalCustomer']
  savedCards: SavedCard[]
  onOrderUpdated: (order: schemas['CustomerOrder']) => void
  onSucceeded: () => void
}) => {
  const stripe = useStripe()
  const elements = useElements()
  const updateOrder = useCustomerOrderUpdate(api)
  const { state, pay, reset } = useReactivationPayment({
    api,
    orderId: order.id,
  })
  const [savedCardId, setSavedCardId] = useState<string | null>(null)
  const [useNewCard, setUseNewCard] = useState(savedCards.length === 0)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingBilling, setEditingBilling] = useState(
    () => !hasCompleteBillingAddress(order.billing_address),
  )

  const form = useForm<CustomerPortalCustomerUpdate>({
    defaultValues: getBillingDetailsValues({ ...order, name: customer.name }),
  })
  const { control, handleSubmit, setError } = form
  const { isDirty } = useFormState({ control })

  useEffect(() => {
    if (state.status === 'succeeded') {
      onSucceeded()
    }
  }, [state.status, onSucceeded])

  const showValidationErrors = (errors: schemas['ValidationError'][]) => {
    setValidationErrors(errors, setError)
    setEditingBilling(true)
  }

  const saveBillingDetails = async (data: CustomerPortalCustomerUpdate) => {
    const { data: updated, error } = await updateOrder.mutateAsync({
      id: order.id,
      body: {
        billing_name: data.billing_name,
        billing_address: data.billing_address ?? undefined,
        tax_id: data.tax_id,
      },
    })
    if (!updated) {
      if (error && 'detail' in error && Array.isArray(error.detail)) {
        showValidationErrors(error.detail)
      } else {
        setNotice('Your billing details could not be saved. Try again.')
      }
      return null
    }
    onOrderUpdated(updated)
    form.reset(getBillingDetailsValues({ ...updated, name: customer.name }))
    if (hasCompleteBillingAddress(updated.billing_address)) {
      setEditingBilling(false)
    }
    return updated
  }

  const needsPaymentMethod = requiresPaymentMethod(order)
  const hasPaymentSource = useNewCard ? !!elements : !!savedCardId

  const onSubmit = async (data: CustomerPortalCustomerUpdate) => {
    setNotice(null)
    reset()

    if (isDirty || !hasCompleteBillingAddress(order.billing_address)) {
      const updated = await saveBillingDetails(data)
      if (!updated) {
        return
      }
      if (updated.due_amount !== order.due_amount) {
        setNotice(
          `Your total is now ${formatCurrency('compact')(updated.due_amount, updated.currency)}, including tax for your billing address. Review it and confirm to pay.`,
        )
        return
      }
    }

    const errors = await pay(
      stripe,
      !needsPaymentMethod
        ? null
        : useNewCard && elements
          ? { elements }
          : { paymentMethodId: savedCardId as string },
    )
    if (errors) {
      showValidationErrors(errors)
    }
  }

  const isBusy =
    updateOrder.isPending ||
    state.status === 'paying' ||
    state.status === 'confirming' ||
    state.status === 'succeeded'

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-6">
        <BillingDetailsCard
          order={order}
          customer={customer}
          editing={editingBilling}
          onEdit={() => setEditingBilling(true)}
          onCancel={
            hasCompleteBillingAddress(order.billing_address)
              ? () => {
                  form.reset()
                  setEditingBilling(false)
                }
              : undefined
          }
          disabled={isBusy}
        />
        {needsPaymentMethod && (
          <PaymentMethodCard
            savedCards={savedCards}
            useNewCard={useNewCard}
            onUseNewCardChange={setUseNewCard}
            onSelectSavedCard={setSavedCardId}
            disabled={isBusy}
          />
        )}
        {notice && <Alert variant="info" title={notice} />}
        {state.status === 'failed' && (
          <Alert
            variant="danger"
            title="Payment failed"
            description={state.error}
          />
        )}
        {state.status === 'confirming' && (
          <Alert
            variant="info"
            loading
            title="Confirming your payment…"
            description="This can take a few moments. Keep this page open."
          />
        )}
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isBusy}
          disabled={isBusy || (needsPaymentMethod && !hasPaymentSource)}
        >
          {!hasCompleteBillingAddress(order.billing_address)
            ? 'Continue'
            : order.is_payment_required
              ? `Pay ${formatCurrency('compact')(order.due_amount, order.currency)} and subscribe`
              : 'Reactivate subscription'}
        </Button>
      </form>
    </Form>
  )
}
