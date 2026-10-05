import { describe, expect, it } from 'vitest'
import { SchemaError } from './error'
import { usd } from './money'

describe('usd', () => {
  it('stores a dollar price in cents', () => {
    expect(usd(15)).toEqual({ amount: '1500', currency: 'usd' })
    expect(usd(0.04)).toEqual({ amount: '4', currency: 'usd' })
    expect(usd(0.00015)).toEqual({ amount: '0.015', currency: 'usd' })
  })

  it('converts without float rounding', () => {
    expect(usd(0.07).amount).toBe('7')
    expect(usd(1.13).amount).toBe('113')
    expect(usd(1.5).amount).toBe('150')
    expect(usd(0).amount).toBe('0')
    expect(usd(-0).amount).toBe('0')
  })

  it('expands exponent notation', () => {
    expect(usd(1e-7).amount).toBe('0.00001')
    expect(usd(1.5e-10).amount).toBe('0.000000015')
  })

  it('rejects an amount that is not a non-negative number', () => {
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const price = () => usd(amount)

      expect(price).toThrow(SchemaError)
      expect(price).toThrow(
        `usd: amount must be a non-negative number, got ${String(amount)}`,
      )
    }
  })

  it('rejects a string', () => {
    // @ts-expect-error amounts are numbers
    const price = () => usd('0.04')

    expect(price).toThrow('usd: amount must be a non-negative number, got 0.04')
  })

  it('rejects an amount of 1000 or more', () => {
    expect(usd(999.99).amount).toBe('99999')

    for (const amount of [1000, 1e21]) {
      const price = () => usd(amount)

      expect(price).toThrow(SchemaError)
      expect(price).toThrow(`usd: amount must be less than 1000, got ${amount}`)
    }
  })

  it('rejects more than 14 decimal places', () => {
    const price = () => usd(1e-15)

    expect(price).toThrow(SchemaError)
    expect(price).toThrow(
      'usd: amount can have at most 14 decimal places, got 1e-15',
    )
  })

  it('rejects an amount a number cannot hold exactly', () => {
    // oxlint-disable-next-line no-loss-of-precision
    const typed = () => usd(999.12345678901234)
    const computed = () => usd(123.4 * 3)

    expect(typed).toThrow(SchemaError)
    expect(typed).toThrow(
      'usd: amount has more than 15 significant digits, got 999.1234567890124',
    )
    expect(computed).toThrow(
      'usd: amount has more than 15 significant digits, got 370.20000000000005',
    )
  })
})
