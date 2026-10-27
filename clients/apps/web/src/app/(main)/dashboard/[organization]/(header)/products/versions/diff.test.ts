import { describe, expect, it } from 'vitest'
import { formatValue, summarize, versionLabel, type ProductDiff } from './diff'

const product = (change: ProductDiff['change']): ProductDiff => ({
  external_id: change,
  name: change,
  product_id: null,
  previous_product_id: null,
  change,
  diff: [],
})

describe('summarize', () => {
  it('counts products by change', () => {
    expect(
      summarize([
        product('added'),
        product('changed'),
        product('unchanged'),
        product('unchanged'),
      ]),
    ).toEqual({ added: 1, changed: 1, removed: 0, unchanged: 2 })
  })
})

describe('versionLabel', () => {
  it('falls back to a version number', () => {
    expect(versionLabel('Spring pricing', 3)).toBe('Spring pricing')
    expect(versionLabel(null, 3)).toBe('Version 3')
  })
})

describe('formatValue', () => {
  it('renders prices as money and everything else plainly', () => {
    expect(
      formatValue('prices', [
        {
          amount_type: 'fixed',
          price_amount: 19900,
          price_currency: 'usd',
          tax_behavior: null,
        },
      ]),
    ).toBe('$199')
    expect(formatValue('benefits', ['a', 'b'])).toBe('a, b')
    expect(formatValue('benefits', [])).toBe('none')
    expect(formatValue('description', null)).toBe('none')
    expect(formatValue('metadata', { tier: 'pro' })).toBe('{"tier":"pro"}')
  })
})
