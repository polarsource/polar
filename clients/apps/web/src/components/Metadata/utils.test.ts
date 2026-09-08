import { describe, expect, it } from 'vitest'
import {
  convertMetadataValue,
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

describe('convertMetadataValue', () => {
  it('coerces a number to a string', () => {
    expect(convertMetadataValue(5, 'string')).toBe('5')
  })

  it('coerces a boolean true to a string', () => {
    expect(convertMetadataValue(true, 'string')).toBe('true')
  })

  it('does not launder NaN into the literal string "NaN"', () => {
    expect(convertMetadataValue(Number.NaN, 'string')).toBe('')
  })

  it('coerces a string to a number', () => {
    expect(convertMetadataValue('3.14', 'number')).toBe(3.14)
  })

  it('coerces a boolean to a number', () => {
    expect(convertMetadataValue(true, 'number')).toBe(1)
  })

  it('coerces the string "true" to boolean true', () => {
    expect(convertMetadataValue('true', 'boolean')).toBe(true)
  })

  it('coerces any other string to boolean false', () => {
    expect(convertMetadataValue('5', 'boolean')).toBe(false)
  })
})
