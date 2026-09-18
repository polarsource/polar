import { describe, expect, it } from 'vitest'
import {
  importTaxBehavior,
  importTaxHint,
  importTaxLabel,
  importTaxSaveError,
} from './importTax'

describe('importTaxBehavior', () => {
  it('defaults missing Polar tax to inclusive', () => {
    expect(importTaxBehavior({ tax_behavior: null })).toBe('inclusive')
  })

  it('keeps an exclusive choice', () => {
    expect(importTaxBehavior({ tax_behavior: 'exclusive' })).toBe('exclusive')
  })
})

describe('importTaxLabel', () => {
  it('labels the default as Inclusive', () => {
    expect(importTaxLabel({ tax_behavior: null })).toBe('Inclusive')
  })

  it('labels exclusive as Exclusive', () => {
    expect(importTaxLabel({ tax_behavior: 'exclusive' })).toBe('Exclusive')
  })
})

describe('importTaxHint', () => {
  it('explains inclusive as keeping the listed price', () => {
    expect(importTaxHint('inclusive')).toContain('listed price')
  })

  it('explains exclusive as tax on top', () => {
    expect(importTaxHint('exclusive')).toContain('on top')
  })
})

describe('importTaxSaveError', () => {
  it('uses a non-empty Error message', () => {
    expect(
      importTaxSaveError(new Error('Tax can only be set on a subscription.')),
    ).toBe('Tax can only be set on a subscription.')
  })

  it('falls back for a non-Error', () => {
    expect(importTaxSaveError({})).toBe("We couldn't save the tax setting.")
  })
})
