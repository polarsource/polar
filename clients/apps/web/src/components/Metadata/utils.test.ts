import { describe, expect, it } from 'vitest'
import { validateMetadataKey, validateMetadataValue } from './utils'

describe('validateMetadataKey', () => {
  it('rejects an empty key', () => {
    expect(validateMetadataKey('')).toBe('Key is required')
  })

  it('accepts a non-empty key', () => {
    expect(validateMetadataKey('plan')).toBe(true)
  })
})

describe('validateMetadataValue', () => {
  it('rejects an empty string value', () => {
    expect(validateMetadataValue('')).toBe('Value is required')
  })

  it('rejects a value that is not a valid number', () => {
    expect(validateMetadataValue(Number.NaN)).toBe('Must be a valid number')
  })

  it('accepts strings, finite numbers and booleans', () => {
    expect(validateMetadataValue('pro')).toBe(true)
    expect(validateMetadataValue(0)).toBe(true)
    expect(validateMetadataValue(false)).toBe(true)
  })
})
