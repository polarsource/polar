import type { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { useFormState, useWatch, type Control } from 'react-hook-form'
import {
  BILLING_ADDRESS_FIELDS,
  resolveBillingAddressFields,
  type BillingAddressField,
} from '../utils/address'

export const useBillingAddressFields = (
  checkout: schemas['CheckoutPublic'],
  control: Control<schemas['CheckoutUpdatePublic']>,
) => {
  const country = useWatch({
    control,
    name: 'customer_billing_address.country',
  })
  const { errors } = useFormState({
    control,
    name: 'customer_billing_address',
  })
  const [revealed, setRevealed] = useState<{
    country: typeof country
    fields: BillingAddressField[]
  }>({ country, fields: [] })

  const revealedFields = revealed.country === country ? revealed.fields : []
  const newlyErrored = BILLING_ADDRESS_FIELDS.filter(
    (field) =>
      errors.customer_billing_address?.[field] &&
      !revealedFields.includes(field),
  )
  if (newlyErrored.length > 0) {
    setRevealed({ country, fields: [...revealedFields, ...newlyErrored] })
  }

  return resolveBillingAddressFields(checkout.billing_address_fields, country, [
    ...revealedFields,
    ...newlyErrored,
  ])
}
