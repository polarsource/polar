import { expect, test } from 'vitest'
import {
  currency,
  per,
  perMillion,
  perThousand,
  scaleRate,
  unitAmount,
  usd,
} from './money'

test('unitAmount scales sub-cent rates without floating point drift', () => {
  expect(unitAmount(usd(100))).toBe('100')
  expect(unitAmount(perThousand(usd(100)))).toBe('0.1')
  expect(unitAmount(perThousand(usd(3)))).toBe('0.003')
  expect(unitAmount(perMillion(usd(1)))).toBe('0.000001')
  expect(unitAmount(perMillion(currency('gbp')(1_250_000)))).toBe('1.25')
})

test('unitAmount rejects fractional and negative amounts', () => {
  expect(() => unitAmount(usd(1.5))).toThrow('non-negative integers')
  expect(() => unitAmount(perThousand(usd(-1)))).toThrow(
    'non-negative integers',
  )
})

test('per charges an amount for any power of ten up to 10^12', () => {
  expect(unitAmount(per(1_000_000_000, usd(75)))).toBe('0.000000075')
  expect(unitAmount(per(1_000_000_000_000, usd(1)))).toBe('0.000000000001')
  expect(unitAmount(per(10, usd(5)))).toBe('0.5')
  // @ts-expect-error not a power of ten
  per(500, usd(1))
  // @ts-expect-error a plain amount isn't a rate
  per(1, usd(1))
  // @ts-expect-error scales don't nest
  per(1_000, perThousand(usd(1)))
  expect(() =>
    unitAmount({ currency: 'usd', amount: 1, per: 500 as 1_000 }),
  ).toThrow('power of ten')
})

test('scaleRate picks the smallest thousand step that makes the amount whole', () => {
  expect(scaleRate('100')).toEqual({ amount: 100, per: 1 })
  expect(scaleRate('0.1')).toEqual({ amount: 100, per: 1_000 })
  expect(scaleRate('0.0001')).toEqual({ amount: 100, per: 1_000_000 })
  expect(scaleRate('0.0000075')).toEqual({ amount: 7500, per: 1_000_000_000 })
  expect(scaleRate('10000.000000000000')).toEqual({ amount: 10000, per: 1 })
  expect(scaleRate('0.100')).toEqual({ amount: 100, per: 1_000 })
  // 10^9 would overflow, so it falls back to the exact 10^7
  expect(scaleRate('123456789.0000001')).toEqual({
    amount: 1234567890000001,
    per: 10_000_000,
  })
  expect(scaleRate('0.000000000001')).toEqual({
    amount: 1,
    per: 1_000_000_000_000,
  })
})
