import { expect, test } from 'vitest'
import {
  currency,
  jpy,
  majorAmount,
  per,
  perMillion,
  perThousand,
  scaleRate,
  unitAmount,
  usd,
} from './money'

test('unitAmount scales sub-cent rates without floating point drift', () => {
  expect(unitAmount(usd(1))).toBe('100')
  expect(unitAmount(perThousand(usd(1)))).toBe('0.1')
  expect(unitAmount(perThousand(usd(0.03)))).toBe('0.003')
  expect(unitAmount(perMillion(usd(0.01)))).toBe('0.000001')
  expect(unitAmount(perMillion(currency('gbp')(12_500)))).toBe('1.25')
})

test('currency takes amounts in the major unit', () => {
  expect(usd(1).amount).toBe(100)
  expect(usd(0.5).amount).toBe(50)
  expect(usd(0.29).amount).toBe(29)
  expect(usd(19.99).amount).toBe(1999)
  expect(jpy(500).amount).toBe(500)
})

test('currency rejects more decimals than the currency has', () => {
  // @ts-expect-error caught at compile time for literals
  expect(() => usd(0.381)).toThrow('at most 2 decimals')
  // @ts-expect-error yen has no decimals
  expect(() => jpy(1.5)).toThrow('whole numbers')
  // @ts-expect-error negative
  expect(() => usd(-1)).toThrow('non-negative')
  // A plain number is only checked at runtime
  const amount = (value: number) => value
  expect(() => usd(amount(0.381))).toThrow('at most 2 decimals')
  expect(() => usd(amount(0.1 + 0.2))).toThrow('at most 2 decimals')
})

test('majorAmount writes the smallest unit back as a major amount', () => {
  expect(majorAmount('usd', 1999)).toBe('19.99')
  expect(majorAmount('usd', 50)).toBe('0.5')
  expect(majorAmount('usd', 10000)).toBe('100')
  expect(majorAmount('jpy', 500)).toBe('500')
})

test('unitAmount rejects fractional and negative amounts', () => {
  expect(() => unitAmount({ currency: 'usd', amount: 1.5, per: 1 })).toThrow(
    'non-negative integers',
  )
  expect(() => unitAmount({ currency: 'usd', amount: -1, per: 1_000 })).toThrow(
    'non-negative integers',
  )
})

test('per charges an amount for any power of ten up to 10^12', () => {
  expect(unitAmount(per(1_000_000_000, usd(0.75)))).toBe('0.000000075')
  expect(unitAmount(per(1_000_000_000_000, usd(0.01)))).toBe('0.000000000001')
  expect(unitAmount(per(10, usd(0.05)))).toBe('0.5')
  // @ts-expect-error not a power of ten
  per(500, usd(0.01))
  // @ts-expect-error a plain amount isn't a rate
  per(1, usd(0.01))
  // @ts-expect-error scales don't nest
  per(1_000, perThousand(usd(0.01)))
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
