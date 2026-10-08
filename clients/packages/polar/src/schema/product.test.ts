import { Schema } from 'effect'
import { expect, test } from 'vitest'
import { eur, perThousand, usd } from './money'
import { fixed, free, metered, seats, tier, units } from './price'
import { product, ProductConfig, productPrices } from './product'
import type { ProductDefinition } from './product'

test('a product needs prices and a billing cycle', () => {
  // @ts-expect-error missing billing cycle
  const unbilled: ProductDefinition = product().prices(free())
  // @ts-expect-error missing prices
  const unpriced: ProductDefinition = product().recurring('monthly')
  // @ts-expect-error trials only apply to recurring products
  product().prices(free()).once().trial(1, 'month')
  expect([unbilled, unpriced]).toHaveLength(2)
})

test('recurring accepts a cadence or an interval count', () => {
  expect(product().recurring('yearly').billing).toEqual({
    recurring_interval: 'year',
    recurring_interval_count: 1,
  })
  expect(product().recurring(3, 'months').billing).toEqual({
    recurring_interval: 'month',
    recurring_interval_count: 3,
  })
  expect(product().recurring('monthly').trial(1, 'week').trialPeriod).toEqual({
    trial_interval: 'week',
    trial_interval_count: 1,
  })
})

test('free prices follow the currencies of the other prices', () => {
  const definition = product()
    .prices(
      free(),
      metered('calls')
        .flat()
        .amount(perThousand(eur(5))),
    )
    .recurring('monthly')
  expect(productPrices('pro', definition)).toEqual([
    { amount_type: 'fixed', price_currency: 'eur', price_amount: 0 },
    {
      amount_type: 'metered_unit',
      price_currency: 'eur',
      meter_external_id: 'calls',
      unit_amount: '0.005',
    },
  ])
  expect(
    productPrices('free', product().prices(free()).recurring('monthly')),
  ).toEqual([{ amount_type: 'fixed', price_currency: 'usd', price_amount: 0 }])
})

test('all prices in a product share the same currencies', () => {
  const definition = product()
    .prices(
      fixed().amount(usd(1000), eur(900)),
      seats().flat().amount(usd(100)),
    )
    .recurring('monthly')
  expect(() => productPrices('pro', definition)).toThrow(
    'Price 2 of product "pro" must have amounts in the same currencies as the product\'s other prices (usd, eur).',
  )
})

test('one-time products cannot have metered prices', () => {
  const definition = product()
    .prices(metered('calls').flat().amount(usd(1)))
    .once()
  expect(() => productPrices('pack', definition)).toThrow(
    "can't have metered prices",
  )
})

const decodeProduct = (
  ...prices: Parameters<ReturnType<typeof product>['prices']>
) =>
  Schema.decodeUnknownSync(ProductConfig)({
    external_id: 'pro',
    name: 'Pro',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    prices: productPrices(
      'pro',
      product()
        .prices(...prices)
        .recurring('monthly'),
    ),
    benefit_external_ids: [],
  })

test('products allow one fixed price with seats or units plus a price per meter', () => {
  expect(() =>
    decodeProduct(
      fixed().amount(usd(1000), eur(900)),
      seats().flat().amount(usd(100), eur(90)),
      metered('calls').flat().amount(usd(1), eur(1)),
      metered('tokens').graduated(tier().amount(usd(1), eur(1))),
    ),
  ).not.toThrow()
  expect(() =>
    decodeProduct(free(), units().flat().amount(usd(100))),
  ).not.toThrow()
})

test('products reject price combinations the API does not support', () => {
  expect(() =>
    decodeProduct(fixed().amount(usd(1000)), fixed().amount(usd(2000))),
  ).toThrow('Only one fixed or free price is allowed.')
  expect(() => decodeProduct(free(), fixed().amount(usd(1000)))).toThrow(
    'Only one fixed or free price is allowed.',
  )
  expect(() =>
    decodeProduct(
      seats().flat().amount(usd(100)),
      seats().flat().amount(usd(200)),
    ),
  ).toThrow('Only one seat-based price is allowed.')
  expect(() =>
    decodeProduct(
      units().flat().amount(usd(100)),
      units().flat().amount(usd(200)),
    ),
  ).toThrow('Only one unit-based price is allowed.')
  expect(() =>
    decodeProduct(
      seats().flat().amount(usd(100)),
      units().flat().amount(usd(200)),
    ),
  ).toThrow('A seat-based price cannot be combined with a unit-based price.')
  expect(() =>
    decodeProduct(
      metered('calls').flat().amount(usd(1)),
      metered('calls').volume(tier().amount(usd(2))),
    ),
  ).toThrow('Meter "calls" is used by more than one price.')
})
