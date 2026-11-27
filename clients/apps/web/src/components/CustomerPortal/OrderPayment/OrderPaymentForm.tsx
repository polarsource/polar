'use client'

import { useCustomerOrderUpdate } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import useDebounce from '@/utils/useDebounce'
import { MandateText } from '@polar-sh/checkout/components'
import { type Client, type schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, Button } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import {
  getTaxAddressFields,
  type TaxAddressField,
} from '@polar-sh/ui/lib/taxAddressFields'
import { useElements, useStripe } from '@stripe/react-stripe-js'
import { useEffect, useRef, useState } from 'react'
import { useForm, useFormState, useWatch } from 'react-hook-form'
import {
  type CustomerPortalCustomerUpdate,
  getBillingDetailsValues,
  hasCompleteBillingAddress,
} from '../BillingDetailsFields'
import { BillingDetailsCard } from './BillingDetailsCard'
import { PaymentMethodCard } from './PaymentMethodCard'
import { useOrderPayment } from './useOrderPayment'

type SavedCard = schemas['PaymentMethodCard'] | schemas['PaymentMethodKrCard']

const requiresPaymentMethod = (order: schemas['CustomerOrder']) =>
  order.is_payment_required || order.is_payment_setup_required

// Identifies the address fields that feed tax calculation, so we only
// recalculate when one of them changes. Null while any of them is missing.
const getTaxAddressKey = (
  address: Partial<Record<TaxAddressField, string | null>> | null | undefined,
) => {
  if (!address?.country) {
    return null
  }
  const values = getTaxAddressFields(address.country).map(
    (field) => address[field] || null,
  )
  return values.every(Boolean) ? JSON.stringify(values) : null
}

export const OrderPaymentForm = ({
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
  // A draft order's amounts follow its billing details. Once finalized (e.g. a
  // past-due renewal), the tax-relevant details and the tax ID are fixed.
  const isDraft = order.status === 'draft'
  const { state, pay, reset } = useOrderPayment({
    api,
    orderId: order.id,
    isDraft,
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
  const { control, handleSubmit, setError, getValues, setValue } = form
  const { isDirty } = useFormState({ control })

  const billingAddress = useWatch({ control, name: 'billing_address' })
  const taxAddressKey = useDebounce(getTaxAddressKey(billingAddress), 500)
  const orderTaxAddressKey = getTaxAddressKey(order.billing_address)
  const latestTaxUpdate = useRef(0)

  useEffect(() => {
    if (state.status === 'succeeded') {
      onSucceeded()
    }
    // Only on the transition: the callback changes identity on every render,
    // and re-running it would repeat the toast and navigation.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status])

  const showValidationErrors = (errors: schemas['ValidationError'][]) => {
    setValidationErrors(errors, setError)
    setEditingBilling(true)
  }

  const saveBillingDetails = async (data: CustomerPortalCustomerUpdate) => {
    latestTaxUpdate.current++
    const { data: updated, error } = await updateOrder.mutateAsync({
      id: order.id,
      body: {
        billing_name: data.billing_name,
        billing_address: data.billing_address ?? undefined,
        ...(isDraft ? { tax_id: data.tax_id } : {}),
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

  // Recalculate tax as soon as the tax-relevant address fields change, so
  // the summary reflects the new total before the customer confirms.
  useEffect(() => {
    if (!isDraft || !taxAddressKey || taxAddressKey === orderTaxAddressKey) {
      return
    }
    const address = getValues('billing_address')
    if (!address?.country) {
      return
    }
    // A tax ID only holds for the country it was issued in.
    const countryChanged = address.country !== order.billing_address?.country
    if (countryChanged) {
      setValue('tax_id', null)
    }
    const request = ++latestTaxUpdate.current
    updateOrder
      .mutateAsync({
        id: order.id,
        body: {
          billing_address: address,
          ...(countryChanged ? { tax_id: null } : {}),
        },
      })
      .then(({ data: updated, error }) => {
        if (request !== latestTaxUpdate.current) {
          return
        }
        if (updated) {
          onOrderUpdated(updated)
        } else if (error && 'detail' in error && Array.isArray(error.detail)) {
          setValidationErrors(error.detail, setError)
        }
      })
      .catch(() => {})
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [taxAddressKey])

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

  const formattedDueAmount = formatCurrency('compact')(
    order.due_amount,
    order.currency,
  )
  const submitLabel = !isDraft
    ? `Pay ${formattedDueAmount}`
    : order.is_payment_required
      ? `Pay ${formattedDueAmount} and subscribe`
      : 'Reactivate subscription'

  const canEditBilling =
    isDraft || !hasCompleteBillingAddress(order.billing_address)

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-6">
        <BillingDetailsCard
          order={order}
          customer={customer}
          editing={editingBilling}
          onEdit={canEditBilling ? () => setEditingBilling(true) : undefined}
          onCancel={
            hasCompleteBillingAddress(order.billing_address)
              ? () => {
                  form.reset(
                    getBillingDetailsValues({ ...order, name: customer.name }),
                  )
                  setEditingBilling(false)
                }
              : undefined
          }
          onSave={
            hasCompleteBillingAddress(order.billing_address)
              ? handleSubmit(async (data) => {
                  setNotice(null)
                  await saveBillingDetails(data)
                })
              : undefined
          }
          saving={updateOrder.isPending}
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
          {submitLabel}
        </Button>
        <MandateText
          isPaymentRequired={order.is_payment_required}
          isTrial={false}
          isRecurring
          buttonLabel={submitLabel}
        />
      </form>
    </Form>
  )
}
