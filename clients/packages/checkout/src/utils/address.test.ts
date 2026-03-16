import { describe, expect, it } from 'vitest'
import { isDisplayedField, isRequiredField } from './address'

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
