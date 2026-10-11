import { Schema } from 'effect'
import { expect, expectTypeOf, test } from 'vitest'
import { discount, DiscountConfig, discountConfig } from './discount'
import type { DiscountDefinition } from './discount'
import { eur, jpy, usd } from './money'

const decode = Schema.decodeUnknownSync(DiscountConfig, {
  onExcessProperty: 'error',
})

test('a discount needs a value and a duration', () => {
  const typeOnly = () => {
    // @ts-expect-error missing duration
    const valueOnly: DiscountDefinition = discount().percent(10)
    // @ts-expect-error missing value
    const durationOnly: DiscountDefinition = discount().once()
    // @ts-expect-error percentages have at most 2 decimals
    discount().percent(12.345)
    // @ts-expect-error amounts are money, not numbers
    discount().amount(10)
    // @ts-expect-error codes are strings
    discount().code(20)
    return [valueOnly, durationOnly]
  }
  expectTypeOf(typeOnly).toBeFunction()
})

test('percent discounts serialize to basis points', () => {
  expect(
    discountConfig(
      'launch',
      discount('Launch 20%')
        .percent(20)
        .repeating(3, 'months')
        .code('LAUNCH20')
        .products('pro', 'team')
        .maxRedemptions(500)
        .endsAt('2026-12-31'),
    ),
  ).toEqual({
    external_id: 'launch',
    name: 'Launch 20%',
    type: 'percentage',
    basis_points: 2000,
    duration: 'repeating',
    duration_in_months: 3,
    code: 'LAUNCH20',
    ends_at: '2026-12-31T00:00:00Z',
    max_redemptions: 500,
    products: ['pro', 'team'],
  })
  expect(
    discountConfig('half', discount().percent(12.5).forever()),
  ).toMatchObject({ name: 'half', basis_points: 1250, duration: 'forever' })
  expect(
    discountConfig('cents', discount().percent(0.01).once()),
  ).toMatchObject({ basis_points: 1 })
})

test('fixed discounts serialize amounts per currency in minor units', () => {
  expect(
    discountConfig(
      'welcome',
      discount('Welcome $10')
        .amount(usd(10), eur(9.5), jpy(1500))
        .once()
        .perCustomer(1)
        .startsAt(new Date('2026-01-01T12:30:00.250Z')),
    ),
  ).toEqual({
    external_id: 'welcome',
    name: 'Welcome $10',
    type: 'fixed',
    amounts: { usd: 1000, eur: 950, jpy: 1500 },
    duration: 'once',
    max_redemptions_per_customer: 1,
    starts_at: '2026-01-01T12:30:00.250Z',
  })
})

test('repeating durations in years are counted in months', () => {
  expect(discount().percent(10).repeating(1, 'year').duration).toEqual({
    duration: 'repeating',
    duration_in_months: 12,
  })
  expect(discount().percent(10).repeating(2, 'years').duration).toEqual({
    duration: 'repeating',
    duration_in_months: 24,
  })
  expect(() =>
    decode(
      discountConfig('long', discount().percent(10).repeating(84, 'years')),
    ),
  ).toThrow()
})

test('percent rejects more than 2 decimals or values out of range', () => {
  const percent = (value: number) => value
  for (const value of [12.345, 0, 100.01, -5, 0.001]) {
    expect(() => discount().percent(percent(value))).toThrow(
      'Percentages must be between 0.01 and 100 with at most 2 decimals',
    )
  }
  expect(discount().percent(100).value).toEqual({
    type: 'percentage',
    basis_points: 10000,
  })
})

test('code must be a string', () => {
  const unset: string = Reflect.get({}, 'PARTNER_CODE')
  expect(() =>
    discountConfig('partner', discount().percent(15).forever().code(unset)),
  ).toThrow(
    'Discount "partner" needs a string code, got undefined. If it comes from an environment variable, check that it is set.',
  )
})

test('codes follow the discount API rules', () => {
  const withCode = (code: string) =>
    decode(discountConfig('code', discount().percent(10).once().code(code)))
  expect(() => withCode('AB')).toThrow('between 3 and 256 characters')
  expect(() => withCode('LAUNCH-20')).toThrow('only alphanumeric')
  expect(() => withCode('x'.repeat(257))).toThrow('between 3 and 256')
  expect(withCode('Rabatt2026')).toMatchObject({ code: 'Rabatt2026' })
})

test('discounts reject repeated currencies and products', () => {
  expect(() =>
    discountConfig('dupe', discount().amount(usd(1), usd(2)).once()),
  ).toThrow('Discount "dupe" lists currency "usd" more than once.')
  expect(() =>
    discountConfig('dupe', discount().percent(5).once().products('pro', 'pro')),
  ).toThrow('Discount "dupe" lists product "pro" more than once.')
})

test('dates must be valid and the discount must start before it ends', () => {
  expect(() =>
    discountConfig('bad', discount().percent(5).once().endsAt('soon')),
  ).toThrow('The end date of Discount "bad" must be a Date')
  expect(() =>
    discountConfig(
      'local',
      discount().percent(5).once().startsAt('2026-01-01T10:00'),
    ),
  ).toThrow('a timestamp with a time zone')
  expect(() =>
    decode(
      discountConfig(
        'backwards',
        discount()
          .percent(5)
          .once()
          .startsAt('2026-06-01')
          .endsAt('2026-01-01'),
      ),
    ),
  ).toThrow('ends_at must be after starts_at.')
})

test('only repeating discounts have duration_in_months', () => {
  const base = {
    external_id: 'd',
    name: 'D',
    type: 'percentage',
    basis_points: 100,
  }
  expect(() => decode({ ...base, duration: 'repeating' })).toThrow(
    'A repeating discount needs duration_in_months.',
  )
  expect(() =>
    decode({ ...base, duration: 'once', duration_in_months: 3 }),
  ).toThrow('Only a repeating discount has duration_in_months.')
})

test('fixed discounts need an amount in a known currency', () => {
  const fixed = (amounts: object) =>
    decode({
      external_id: 'd',
      name: 'D',
      type: 'fixed',
      amounts,
      duration: 'once',
    })
  expect(() => fixed({})).toThrow()
  expect(() => fixed({ xyz: 100 })).toThrow('Unknown currency "xyz".')
  expect(() => fixed({ usd: -1 })).toThrow()
  expect(fixed({ usd: 0 })).toMatchObject({ amounts: { usd: 0 } })
})
