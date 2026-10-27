import type { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { getDiscountDisplay } from './discount'

describe('getDiscountDisplay', () => {
  it('shows every configured currency for a fixed discount', () => {
    const discount = {
      id: 'discount',
      name: 'Multi-currency discount',
      code: null,
      type: 'fixed',
      duration: 'once',
      amounts: { usd: 500, eur: 1000 },
    } satisfies schemas['CheckoutDiscountFixedOnceForeverDuration']

    expect(getDiscountDisplay(discount)).toBe('-$5, -€10')
  })

  it('keeps zero amounts visible', () => {
    const discount = {
      id: 'discount',
      name: 'Zero discount',
      code: null,
      type: 'fixed',
      duration: 'once',
      amounts: { usd: 0 },
    } satisfies schemas['CheckoutDiscountFixedOnceForeverDuration']

    expect(getDiscountDisplay(discount)).toBe('-$0')
  })
})
