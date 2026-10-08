import { Schema } from 'effect'
import { expect, test } from 'vitest'
import { eur, per, perMillion, perThousand, usd } from './money'
import {
  fixed,
  free,
  metered,
  PriceConfig,
  priceConfigs,
  priceCurrencies,
  seats,
  tier,
  units,
} from './price'

test('prices only accept priced tiers', () => {
  // @ts-expect-error a tier without an amount
  seats().graduated(tier().max(5))
  // @ts-expect-error a tier without an amount
  units().volume(tier().max(5).amount(usd(100)), tier())
  // @ts-expect-error a tier without an amount
  metered('calls').graduated(tier())
  // @ts-expect-error at least one tier
  seats().volume()
  // @ts-expect-error at least one amount
  fixed().amount()
})

test('sub-cent amounts are only accepted on metered prices', () => {
  // @ts-expect-error sub-cent fixed price
  fixed().amount(perThousand(usd(100)))
  // @ts-expect-error sub-cent fixed price
  fixed().amount(per(1_000_000_000, usd(100)))
  const flatSeats = seats().flat()
  // @ts-expect-error sub-cent seat price
  flatSeats.amount(perMillion(usd(100)))
  // @ts-expect-error sub-cent unit tier
  units().graduated(tier().amount(perThousand(usd(100))))
  const usage = metered('calls')
    .flat()
    .amount(perThousand(usd(1)))
  // @ts-expect-error sub-cent cap
  usage.cap(perThousand(usd(1)))
  // @ts-expect-error scales don't nest
  perThousand(perThousand(usd(1)))

  metered('calls')
    .flat()
    .amount(perThousand(usd(100)), eur(1))
  metered('calls').volume(
    tier()
      .max(1000)
      .amount(perMillion(usd(100))),
    tier().amount(usd(1)),
  )
})

test('free expands to a zero fixed price in each currency', () => {
  expect(priceConfigs(free(), ['usd', 'eur'], 'Price')).toEqual([
    { amount_type: 'fixed', price_currency: 'usd', price_amount: 0 },
    { amount_type: 'fixed', price_currency: 'eur', price_amount: 0 },
  ])
})

test('fixed prices expand to one price per currency', () => {
  const price = fixed().amount(usd(100), eur(90))
  expect(priceCurrencies(price, 'Price')).toEqual(['usd', 'eur'])
  expect(priceConfigs(price, ['usd', 'eur'], 'Price')).toEqual([
    { amount_type: 'fixed', price_currency: 'usd', price_amount: 100 },
    { amount_type: 'fixed', price_currency: 'eur', price_amount: 90 },
  ])
})

test('flat seats are a single volume tier bounded by max', () => {
  const price = seats().flat().min(3).amount(usd(100)).max(1000)
  expect(priceConfigs(price, ['usd'], 'Price')).toEqual([
    {
      amount_type: 'seat_based',
      price_currency: 'usd',
      tiers: { type: 'volume', tiers: [{ bound: 1000, unit_amount: '100' }] },
      minimum_units: 3,
    },
  ])
})

test('tiered units keep their tiering and bound the last tier by max', () => {
  const tiers = [
    tier().max(5).amount(usd(100), eur(100)),
    tier().max(10).amount(usd(90), eur(90)),
    tier().amount(usd(80), eur(80)),
  ] as const
  for (const type of ['graduated', 'volume'] as const) {
    const builder = units()
    const price = builder[type](...tiers)
      .min(3)
      .max(20)
    expect(priceConfigs(price, ['eur'], 'Price')).toEqual([
      {
        amount_type: 'unit_based',
        price_currency: 'eur',
        tiers: {
          type,
          tiers: [
            { bound: 5, unit_amount: '100' },
            { bound: 10, unit_amount: '90' },
            { bound: 20, unit_amount: '80' },
          ],
        },
        minimum_units: 3,
      },
    ])
  }
})

test('tier bounds must increase and only the last tier may be unbounded', () => {
  expect(() =>
    priceConfigs(
      seats().graduated(
        tier().max(10).amount(usd(100)),
        tier().max(5).amount(usd(90)),
      ),
      ['usd'],
      'Price',
    ),
  ).toThrow('increasing tier bounds')
  expect(() =>
    priceConfigs(
      seats().graduated(tier().amount(usd(100)), tier().amount(usd(90))),
      ['usd'],
      'Price',
    ),
  ).toThrow('only leave its last tier unbounded')
  expect(() =>
    priceConfigs(
      seats()
        .volume(tier().max(5).amount(usd(100)), tier().amount(usd(90)))
        .max(3),
      ['usd'],
      'Price',
    ),
  ).toThrow('increasing tier bounds, got 3 after 5')
  expect(() =>
    priceConfigs(
      seats()
        .volume(tier().max(5).amount(usd(100)))
        .max(10),
      ['usd'],
      'Price',
    ),
  ).toThrow('last tier already has a .max()')
})

test('flat metered prices become a metered unit price with a sub-cent rate', () => {
  const price = metered('tool_call')
    .flat()
    .amount(perThousand(usd(100)), perThousand(eur(90)))
    .cap(usd(10000))
  expect(priceConfigs(price, ['usd', 'eur'], 'Price')).toEqual([
    {
      amount_type: 'metered_unit',
      price_currency: 'usd',
      meter_external_id: 'tool_call',
      unit_amount: '0.1',
      cap_amount: 10000,
    },
    {
      amount_type: 'metered_unit',
      price_currency: 'eur',
      meter_external_id: 'tool_call',
      unit_amount: '0.09',
    },
  ])
})

test('tiered metered prices must leave their last tier unbounded', () => {
  const price = metered('tool_call')
    .graduated(
      tier()
        .max(5)
        .amount(perThousand(usd(100))),
      tier().amount(perThousand(usd(80))),
    )
    .cap(usd(100))
  expect(priceConfigs(price, ['usd'], 'Price')).toEqual([
    {
      amount_type: 'metered_tiers',
      price_currency: 'usd',
      meter_external_id: 'tool_call',
      tiers: {
        type: 'graduated',
        tiers: [{ bound: 5, unit_amount: '0.1' }, { unit_amount: '0.08' }],
      },
      cap_amount: 100,
    },
  ])
  expect(() =>
    priceConfigs(
      metered('tool_call').volume(tier().max(5).amount(usd(1))),
      ['usd'],
      'Price',
    ),
  ).toThrow('must leave its last tier unbounded')
})

test('every tier and cap must use the same currencies', () => {
  expect(() =>
    priceCurrencies(
      seats().volume(
        tier().max(5).amount(usd(100), eur(100)),
        tier().amount(usd(80)),
      ),
      'Price',
    ),
  ).toThrow('Price tier 2 must have amounts in the same currencies')
  expect(() =>
    priceCurrencies(
      metered('calls').flat().amount(usd(1)).cap(eur(100)),
      'Price',
    ),
  ).toThrow('has a cap in eur')
  expect(() =>
    priceCurrencies(fixed().amount(usd(1), usd(2)), 'Price'),
  ).toThrow('same currency more than once')
})

const decode = Schema.decodeUnknownSync(PriceConfig)

test('the minimum quantity cannot exceed the maximum', () => {
  const [tooFew] = priceConfigs(
    seats().flat().min(10).amount(usd(100)).max(5),
    ['usd'],
    'Price',
  )
  expect(() => decode(tooFew)).toThrow(
    'The minimum of 10 exceeds the maximum of 5.',
  )
  const [bounded] = priceConfigs(
    units()
      .volume(tier().max(5).amount(usd(100)))
      .min(6),
    ['usd'],
    'Price',
  )
  expect(() => decode(bounded)).toThrow('exceeds the maximum of 5')
  const [unbounded] = priceConfigs(
    units().flat().min(10).amount(usd(100)),
    ['usd'],
    'Price',
  )
  expect(decode(unbounded)).toEqual(unbounded)
})

test('flat metered prices need a rate above zero', () => {
  const [zero] = priceConfigs(
    metered('calls').flat().amount(usd(0)),
    ['usd'],
    'Price',
  )
  expect(() => decode(zero)).toThrow('Flat metered prices need a rate above 0.')
  const [freeTier] = priceConfigs(
    metered('calls').graduated(
      tier().max(100).amount(usd(0)),
      tier().amount(perMillion(usd(1))),
    ),
    ['usd'],
    'Price',
  )
  expect(decode(freeTier)).toEqual(freeTier)
})
