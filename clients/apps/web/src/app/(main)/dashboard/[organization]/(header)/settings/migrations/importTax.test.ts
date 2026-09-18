import { describe, expect, it } from 'vitest'
import {
  importTaxBehavior,
  importTaxHint,
  importTaxLabel,
  importTaxSaveError,
  isImportTaxLocked,
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

  it('falls back when the message is empty', () => {
    expect(importTaxSaveError(new Error(''))).toBe(
      "We couldn't save the tax setting.",
    )
  })

  it('falls back for a non-Error', () => {
    expect(importTaxSaveError({})).toBe("We couldn't save the tax setting.")
  })
})

describe('isImportTaxLocked', () => {
  it('locks tax after the switch has moved the subscription', () => {
    expect(isImportTaxLocked({ cutover_status: 'moved' })).toBe(true)
  })

  it('allows edits before the switch', () => {
    expect(isImportTaxLocked({ cutover_status: null })).toBe(false)
    expect(isImportTaxLocked({ cutover_status: 'failed' })).toBe(false)
  })
})
