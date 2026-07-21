import type { schemas } from '@polar-sh/client'

export const isDisplayedField = (
  mode: schemas['BillingAddressFieldMode'],
): mode is 'required' | 'optional' => {
  return mode === 'required' || mode === 'optional'
}

export const isRequiredField = (
  mode: schemas['BillingAddressFieldMode'],
): mode is 'required' => {
  return mode === 'required'
}

export const resolveBillingAddressFields = (
  fields: schemas['CheckoutBillingAddressFields'],
  requireFullBillingAddress: boolean | undefined,
): schemas['CheckoutBillingAddressFields'] => {
  if (!requireFullBillingAddress) {
    return fields
  }
  return {
    ...fields,
    line1: 'required',
    line2: 'optional',
    city: 'required',
    postal_code: 'required',
  }
}
