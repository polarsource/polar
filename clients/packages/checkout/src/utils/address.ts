import type { BillingAddressFieldMode } from '@spaire/sdk/models/components/billingaddressfieldmode'

export const isDisplayedField = (
  mode: BillingAddressFieldMode,
): mode is 'required' | 'optional' => {
  return mode === 'required' || mode === 'optional'
}

export const isRequiredField = (
  mode: BillingAddressFieldMode,
): mode is 'required' => {
  return mode === 'required'
}
