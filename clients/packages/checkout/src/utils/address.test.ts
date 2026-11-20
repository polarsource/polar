import { describe, expect, it } from 'vitest'
import { isAddressComplete, isDisplayedField, isRequiredField } from './address'

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

describe('isAddressComplete', () => {
  const usFields = {
    country: 'required',
    state: 'required',
    city: 'required',
    postal_code: 'required',
    line1: 'required',
    line2: 'disabled',
  } as const
  const usAddress = {
    country: 'US',
    line1: '548 Market St',
    city: 'San Francisco',
    state: 'US-CA',
    postal_code: '94104',
  } as const

  const countryOnlyFields = {
    country: 'required',
    state: 'disabled',
    city: 'disabled',
    postal_code: 'disabled',
    line1: 'disabled',
    line2: 'disabled',
  } as const
  const fullAddressFields = {
    country: 'required',
    state: 'optional',
    city: 'required',
    postal_code: 'required',
    line1: 'required',
    line2: 'optional',
  } as const

  it('returns true when every required field is filled', () => {
    expect(isAddressComplete(usAddress, usFields)).toBe(true)
  })

  it.each(['line1', 'city', 'state', 'postal_code'] as const)(
    'returns false when the required %s is empty or blank',
    (field) => {
      expect(isAddressComplete({ ...usAddress, [field]: '' }, usFields)).toBe(
        false,
      )
      expect(
        isAddressComplete({ ...usAddress, [field]: '   ' }, usFields),
      ).toBe(false)
      expect(isAddressComplete({ ...usAddress, [field]: null }, usFields)).toBe(
        false,
      )
    },
  )

  it.each([
    '94104',
    '00501',
    '99950',
    ' 94104 ',
    '94 104',
    '94104-1234',
    '941041234',
    '94104 1234',
    '94104 - 1234',
  ])('accepts the US ZIP code %j', (postalCode) => {
    expect(
      isAddressComplete({ ...usAddress, postal_code: postalCode }, usFields),
    ).toBe(true)
  })

  it.each([
    '9',
    '9410',
    '941041',
    '94104-',
    '94104-123',
    '9410412345',
    '94104--1234',
    'ABCDE',
    '94I04',
  ])('waits for a complete US ZIP code instead of %j', (postalCode) => {
    expect(
      isAddressComplete({ ...usAddress, postal_code: postalCode }, usFields),
    ).toBe(false)
  })

  it('requires a ZIP code for US addresses whatever the field modes say', () => {
    expect(
      isAddressComplete(
        { country: 'US', postal_code: undefined },
        countryOnlyFields,
      ),
    ).toBe(false)
  })

  it('returns true for a country-only address', () => {
    expect(isAddressComplete({ country: 'SE' }, countryOnlyFields)).toBe(true)
    expect(isAddressComplete({ country: 'DE' }, countryOnlyFields)).toBe(true)
  })

  it('returns false without a country', () => {
    expect(isAddressComplete({ country: undefined }, countryOnlyFields)).toBe(
      false,
    )
  })

  it('ignores optional and disabled fields outside the US', () => {
    expect(
      isAddressComplete(
        { country: 'DE', postal_code: '1', city: null },
        countryOnlyFields,
      ),
    ).toBe(true)
  })

  it('requires the province for Canada', () => {
    const canadaFields = { ...countryOnlyFields, state: 'required' } as const
    expect(isAddressComplete({ country: 'CA' }, canadaFields)).toBe(false)
    expect(
      isAddressComplete({ country: 'CA', state: 'CA-ON' }, canadaFields),
    ).toBe(true)
  })

  it('does not apply the US ZIP rule to Canadian postal codes', () => {
    expect(
      isAddressComplete(
        {
          country: 'CA',
          state: 'CA-ON',
          line1: '1 Main St',
          city: 'Ottawa',
          postal_code: 'K1A 0B1',
        },
        { ...fullAddressFields, state: 'required' },
      ),
    ).toBe(true)
  })

  it('requires every field a full billing address needs outside the US', () => {
    const address = {
      country: 'GB',
      line1: '10 Downing St',
      city: 'London',
      postal_code: 'SW1A 2AA',
    } as const
    expect(isAddressComplete(address, fullAddressFields)).toBe(true)
    expect(
      isAddressComplete({ ...address, postal_code: '' }, fullAddressFields),
    ).toBe(false)
  })

  it('does not throw on missing values', () => {
    expect(() => isAddressComplete({}, usFields)).not.toThrow()
    expect(isAddressComplete({}, usFields)).toBe(false)
  })
})
