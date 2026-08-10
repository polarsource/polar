import { describe, expect, it } from 'vitest'
import type { ImportedCounts } from './importSummary'
import {
  importedCountsText,
  importedTotal,
  nothingImported,
  plural,
} from './importSummary'

function counts(overrides: Partial<ImportedCounts> = {}): ImportedCounts {
  return { subscriptions: 0, products: 0, customers: 0, ...overrides }
}

describe('importedTotal', () => {
  it('sums every entity', () => {
    expect(
      importedTotal(counts({ subscriptions: 1, products: 3, customers: 13 })),
    ).toBe(17)
  })

  it('is zero when nothing landed', () => {
    expect(importedTotal(counts())).toBe(0)
  })
})

describe('importedCountsText', () => {
  it('joins three entities with a final "and"', () => {
    expect(
      importedCountsText(
        counts({ subscriptions: 1, products: 3, customers: 13 }),
      ),
    ).toBe('1 subscription, 3 products and 13 customers')
  })

  it('drops entities that landed nothing', () => {
    expect(importedCountsText(counts({ products: 3, customers: 7 }))).toBe(
      '3 products and 7 customers',
    )
  })

  it('reads as a bare phrase for a single entity', () => {
    expect(importedCountsText(counts({ products: 2 }))).toBe('2 products')
  })

  it('is empty when nothing landed', () => {
    expect(importedCountsText(counts())).toBe('')
  })
})

describe('nothingImported', () => {
  const settled = { isLoading: false, isFetching: false, isError: false }

  it('is true once a settled read reports no imports', () => {
    expect(nothingImported({ imported: counts(), ...settled })).toBe(true)
  })

  it('is false when something landed', () => {
    expect(
      nothingImported({ imported: counts({ products: 1 }), ...settled }),
    ).toBe(false)
  })

  it('is false while a refetch is in flight over cached zeros', () => {
    expect(
      nothingImported({ imported: counts(), ...settled, isFetching: true }),
    ).toBe(false)
  })

  it('is false on first load and on a failed read', () => {
    expect(
      nothingImported({ imported: counts(), ...settled, isLoading: true }),
    ).toBe(false)
    expect(
      nothingImported({ imported: counts(), ...settled, isError: true }),
    ).toBe(false)
  })
})

describe('plural', () => {
  it('keeps the noun singular at one', () => {
    expect(plural(1, 'record')).toBe('1 record')
  })

  it('pluralises above one', () => {
    expect(plural(4, 'record')).toBe('4 records')
  })

  it('returns null at zero, so callers can drop the phrase', () => {
    expect(plural(0, 'record')).toBeNull()
  })
})
