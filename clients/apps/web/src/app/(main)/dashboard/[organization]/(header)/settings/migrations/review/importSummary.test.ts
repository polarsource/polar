import { describe, expect, it } from 'vitest'
import {
  ImportedCounts,
  importedCountsText,
  importedTotal,
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

  // Callers gate on `importedTotal`, so this only guards against a future one
  // that forgets to.
  it('is empty when nothing landed', () => {
    expect(importedCountsText(counts())).toBe('')
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
