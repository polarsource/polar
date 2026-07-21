import type { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  isDisplayedField,
  isRequiredField,
  resolveBillingAddressFields,
} from './address'

describe('isDisplayedField', () => {
  it('returns true for required', () => {
    expect(isDisplayedField('required')).toBe(true)
  })

  it('returns true for optional', () => {
    expect(isDisplayedField('optional')).toBe(true)
  })

  it('returns false for disabled', () => {
    expect(isDisplayedField('disabled')).toBe(false)
  })
})

describe('isRequiredField', () => {
  it('returns true for required', () => {
    expect(isRequiredField('required')).toBe(true)
  })

  it('returns false for optional', () => {
    expect(isRequiredField('optional')).toBe(false)
  })

  it('returns false for disabled', () => {
    expect(isRequiredField('disabled')).toBe(false)
  })
})

describe('resolveBillingAddressFields', () => {
  const minimalFields: schemas['CheckoutBillingAddressFields'] = {
    country: 'required',
    state: 'disabled',
    line1: 'disabled',
    line2: 'disabled',
    city: 'disabled',
    postal_code: 'disabled',
  }

  it('returns backend fields unchanged when full address is not required', () => {
    expect(resolveBillingAddressFields(minimalFields, false)).toBe(
      minimalFields,
    )
  })

  it('requires line1, city and postal_code when full address is required', () => {
    expect(resolveBillingAddressFields(minimalFields, true)).toEqual({
      country: 'required',
      state: 'disabled',
      line1: 'required',
      line2: 'optional',
      city: 'required',
      postal_code: 'required',
    })
  })

  it('is unchanged when the backend already requires the full address', () => {
    const fullFields: schemas['CheckoutBillingAddressFields'] = {
      country: 'required',
      state: 'required',
      line1: 'required',
      line2: 'optional',
      city: 'required',
      postal_code: 'required',
    }
    expect(resolveBillingAddressFields(fullFields, true)).toEqual(fullFields)
  })
})
