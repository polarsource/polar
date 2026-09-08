import { describe, expect, it } from 'vitest'
import {
  defaultValueForType,
  validateMetadataKey,
  validateMetadataValue,
} from './utils'

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

describe('defaultValueForType', () => {
  it('resets to an empty string for the string type', () => {
    expect(defaultValueForType('string')).toBe('')
  })

  it('resets to NaN for the number type so the row stays invalid until typed', () => {
    expect(Number.isNaN(defaultValueForType('number'))).toBe(true)
  })

  it('resets to false for the boolean type', () => {
    expect(defaultValueForType('boolean')).toBe(false)
  })

  it('never produces a value that launders a rejected number into an accepted string', () => {
    for (const type of ['string', 'number', 'boolean'] as const) {
      const reset = defaultValueForType(type)
      if (type === 'number') {
        expect(validateMetadataValue(reset)).not.toBe(true)
      }
    }
    expect(validateMetadataValue(defaultValueForType('string'))).not.toBe(true)
  })
})
