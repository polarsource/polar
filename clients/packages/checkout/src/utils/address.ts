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

const US_ZIP_CODE = /^\d{5}(-?\d{4})?$/

const isFilled = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''

export const isAddressComplete = (
  address: Partial<schemas['AddressInput']>,
  fields: schemas['CheckoutBillingAddressFields'],
): boolean => {
  const requiredFieldsFilled = (
    Object.keys(fields) as (keyof typeof fields)[]
  ).every(
    (field) => !isRequiredField(fields[field]) || isFilled(address[field]),
  )
  if (!requiredFieldsFilled) {
    return false
  }
  if (address.country === 'US') {
    return (
      isFilled(address.postal_code) &&
      US_ZIP_CODE.test(address.postal_code.replace(/\s/g, ''))
    )
  }
  return true
}
