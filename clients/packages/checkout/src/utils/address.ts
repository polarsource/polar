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

type BillingAddressFields = schemas['CheckoutBillingAddressFields']
type BillingAddressFieldMode = schemas['BillingAddressFieldMode']
export type BillingAddressField = keyof BillingAddressFields

export const BILLING_ADDRESS_FIELDS: BillingAddressField[] = [
  'country',
  'state',
  'line1',
  'line2',
  'city',
  'postal_code',
]

const COUNTRY_REQUIRED_FIELDS: Record<string, Partial<BillingAddressFields>> = {
  US: {
    state: 'required',
    line1: 'required',
    line2: 'optional',
    city: 'required',
    postal_code: 'required',
  },
  CA: { state: 'required' },
}

const MODE_STRICTNESS: Record<BillingAddressFieldMode, number> = {
  disabled: 0,
  optional: 1,
  required: 2,
}

const strictest = (
  a: BillingAddressFieldMode,
  b: BillingAddressFieldMode | undefined,
): BillingAddressFieldMode =>
  b !== undefined && MODE_STRICTNESS[b] > MODE_STRICTNESS[a] ? b : a

export const resolveBillingAddressFields = (
  fields: BillingAddressFields,
  country: string | null | undefined,
  revealedFields: readonly BillingAddressField[] = [],
): BillingAddressFields => {
  const countryFields = (country && COUNTRY_REQUIRED_FIELDS[country]) || {}
  return Object.fromEntries(
    BILLING_ADDRESS_FIELDS.map((field) => [
      field,
      strictest(
        strictest(fields[field], countryFields[field]),
        revealedFields.includes(field) ? 'required' : undefined,
      ),
    ]),
  ) as BillingAddressFields
}
