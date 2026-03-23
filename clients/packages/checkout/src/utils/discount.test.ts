import { describe, expect, it } from 'vitest'
import { getDiscountDisplay } from './discount'

describe('getDiscountDisplay', () => {
  it('formats a percentage discount', () => {
    const discount = {
      type: 'percentage' as const,
      basis_points: 2500,
      duration: 'once' as const,
      id: 'd_1',
      name: '25% off',
      code: null,
    }

    const result = getDiscountDisplay(discount, 'en')
    expect(result).toBe('-25%')
  })

  it('formats a percentage discount with decimals', () => {
    const discount = {
      type: 'percentage' as const,
      basis_points: 1250,
      duration: 'once' as const,
      id: 'd_1',
      name: '12.5% off',
      code: null,
    }

    const result = getDiscountDisplay(discount, 'en')
    expect(result).toBe('-12.5%')
  })

  it('formats a 100% percentage discount', () => {
    const discount = {
      type: 'percentage' as const,
      basis_points: 10000,
      duration: 'forever' as const,
      id: 'd_1',
      name: 'Free',
      code: null,
    }

    const result = getDiscountDisplay(discount, 'en')
    expect(result).toBe('-100%')
  })

  it('formats a fixed discount in USD', () => {
    const discount = {
      type: 'fixed' as const,
      amount: 500,
      currency: 'usd',
      amounts: { usd: 500 },
      duration: 'once' as const,
      duration_in_months: 0,
      id: 'd_1',
      name: '$5 off',
      code: null,
    }

    const result = getDiscountDisplay(discount, 'en')
    expect(result).toContain('5')
    expect(result).toContain('$')
  })

  it('formats a fixed discount in EUR', () => {
    const discount = {
      type: 'fixed' as const,
      amount: 1000,
      currency: 'eur',
      amounts: { eur: 1000 },
      duration: 'once' as const,
      duration_in_months: 0,
      id: 'd_1',
      name: '€10 off',
      code: null,
    }

    const result = getDiscountDisplay(discount, 'en')
    expect(result).toContain('10')
    expect(result).toContain('€')
  })
})
