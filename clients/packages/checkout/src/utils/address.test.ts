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
  const countryOnly = {
    country: 'required',
    state: 'disabled',
    line1: 'disabled',
    line2: 'disabled',
    city: 'disabled',
    postal_code: 'disabled',
  } as const

  it('requires the full address for the US', () => {
    expect(resolveBillingAddressFields(countryOnly, 'US')).toEqual({
      country: 'required',
      state: 'required',
      line1: 'required',
      line2: 'optional',
      city: 'required',
      postal_code: 'required',
    })
  })

  it('requires only the province for Canada', () => {
    expect(resolveBillingAddressFields(countryOnly, 'CA')).toEqual({
      ...countryOnly,
      state: 'required',
    })
  })

  it('keeps the server fields for other countries', () => {
    expect(resolveBillingAddressFields(countryOnly, 'FR')).toEqual(countryOnly)
  })

  it('never loosens what the server requires', () => {
    const full = {
      country: 'required',
      state: 'optional',
      line1: 'required',
      line2: 'optional',
      city: 'required',
      postal_code: 'required',
    } as const
    expect(resolveBillingAddressFields(full, 'FR')).toEqual(full)
  })

  it('requires the fields the server reported errors on', () => {
    expect(
      resolveBillingAddressFields(countryOnly, 'FR', ['postal_code']),
    ).toEqual({ ...countryOnly, postal_code: 'required' })
  })
})
