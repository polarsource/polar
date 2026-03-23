import { describe, expect, it } from 'vitest'
import { capitalize, decapitalize } from './string'

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('leaves already capitalized string unchanged', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })

  it('handles single character', () => {
    expect(capitalize('a')).toBe('A')
  })

  it('handles empty string', () => {
    expect(capitalize('')).toBe('')
  })
})

describe('decapitalize', () => {
  it('lowercases the first letter', () => {
    expect(decapitalize('Hello')).toBe('hello')
  })

  it('leaves already lowercase string unchanged', () => {
    expect(decapitalize('hello')).toBe('hello')
  })

  it('handles single character', () => {
    expect(decapitalize('A')).toBe('a')
  })

  it('handles empty string', () => {
    expect(decapitalize('')).toBe('')
  })
})
