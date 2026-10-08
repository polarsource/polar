import { expect, expectTypeOf, test } from 'vitest'
import { RuntimeSDK } from '../runtime'
import { defineConfig } from './config'
import { gte } from './meter'
import { eur, perThousand, usd } from './money'
import { tier } from './price'

test('config serializes to JSON without exposing mutable internal data', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({
      tokens: meter().count(),
    }),
  })
  const json = config.toJSON()
  expect(json.meters[0]?.name).toBe('tokens')
  expect(JSON.parse(JSON.stringify(config))).toEqual(json)
  Reflect.set(json.meters, 'length', 0)
  expect(config.toJSON().meters).toHaveLength(1)
})

test('RuntimeSDK rejects duplicate IDs without changing JSON serialization', () => {
  const config = defineConfig({
    meters: ({ meter }) => [
      ['calls', meter('First').count()],
      ['calls', meter('Second').count()],
    ],
  })
  expect(config.toJSON().meters).toHaveLength(2)
  expect(() => RuntimeSDK(config, { accessToken: 'test' })).toThrow(
    'duplicate meter external IDs',
  )
})

test('defineConfig rejects empty external IDs even with a valid display name', () => {
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({
        '': meter('Requests').count(),
      }),
    }),
  ).toThrow()
})

test('short meter keys require an explicit display name', () => {
  expect(() =>
    defineConfig({ meters: ({ meter }) => ({ x: meter().count() }) }),
  ).toThrow('Provide a name for meter "x"')

  const config = defineConfig({
    meters: ({ meter }) => ({ x: meter('Requests').count() }),
  })
  expect(config.toJSON().meters[0]).toMatchObject({
    external_id: 'x',
    name: 'Requests',
  })
})

test('defineConfig rejects invalid builder values', () => {
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({
        tokens: meter().where(gte('tokens', 1.5)).count(),
      }),
    }),
  ).toThrow()
})

test('benefits serialize with meter credits linked by meter key', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({ tool_call: meter().count() }),
    benefits: ({ flag, credits }) => ({
      custom_servers: flag('Custom servers'),
      tool_calls: credits().meter('tool_call').units(100),
      rollover_calls: credits('Rollover tool calls')
        .meter('tool_call')
        .units(50)
        .rollover(),
    }),
  })
  expect(config.toJSON().benefits).toEqual([
    {
      external_id: 'custom_servers',
      type: 'feature_flag',
      description: 'Custom servers',
      properties: {},
    },
    {
      external_id: 'tool_calls',
      type: 'meter_credit',
      description: 'tool_calls',
      properties: {
        meter_external_id: 'tool_call',
        units: 100,
        rollover: false,
      },
    },
    {
      external_id: 'rollover_calls',
      type: 'meter_credit',
      description: 'Rollover tool calls',
      properties: {
        meter_external_id: 'tool_call',
        units: 50,
        rollover: true,
      },
    },
  ])
})

test('meter credits only accept declared meter keys', () => {
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({ tool_call: meter().count() }),
      benefits: ({ credits }) => ({
        // @ts-expect-error unknown meter key
        credits: credits().meter('unknown').units(1),
      }),
    }),
  ).toThrow('references unknown meter "unknown"')
})

test('meter credits require positive integer units', () => {
  for (const units of [0, -1, 1.5]) {
    expect(() =>
      defineConfig({
        meters: ({ meter }) => ({ tool_call: meter().count() }),
        benefits: ({ credits }) => ({
          credits: credits().meter('tool_call').units(units),
        }),
      }),
    ).toThrow()
  }
})

test('benefit descriptions must be between 3 and 42 characters', () => {
  expect(() =>
    defineConfig({
      meters: () => ({}),
      benefits: ({ flag }) => ({ ab: flag() }),
    }),
  ).toThrow('Provide a name for benefit "ab"')
  expect(() =>
    defineConfig({
      meters: () => ({}),
      benefits: ({ flag }) => ({
        flag: flag('x'.repeat(43)),
      }),
    }),
  ).toThrow()
})

test('RuntimeSDK exposes configured benefits by external ID', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({ tool_call: meter().count() }),
    benefits: ({ flag }) => ({ custom_servers: flag() }),
  })
  const { actor } = RuntimeSDK(config, { accessToken: 'test' })
  expectTypeOf(actor({ customerId: 'customer-id' }).access)
    .parameter(0)
    .toEqualTypeOf<'custom_servers'>()
})

test('RuntimeSDK rejects duplicate benefit external IDs', () => {
  const config = defineConfig({
    meters: () => ({}),
    benefits: ({ flag }) => [
      ['flag', flag('First')],
      ['flag', flag('Second')],
    ],
  })
  expect(() => RuntimeSDK(config, { accessToken: 'test' })).toThrow(
    'duplicate benefit external IDs',
  )
})

test('products serialize prices per currency and link meters and benefits', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({ tool_call: meter().count() }),
    benefits: ({ flag }) => ({ custom_servers: flag() }),
    products: ({ product, seats, meter }) => ({
      pro: product('Pro')
        .prices(
          seats().flat().amount(usd(1000), eur(900)),
          meter('tool_call')
            .graduated(
              tier().max(1000).amount(usd(0), eur(0)),
              tier().amount(perThousand(usd(100)), perThousand(eur(90))),
            )
            .cap(usd(5000), eur(4500)),
        )
        .recurring('monthly')
        .trial(14, 'days')
        .grants(['custom_servers']),
    }),
  })
  expect(config.toJSON().products).toEqual([
    {
      external_id: 'pro',
      name: 'Pro',
      recurring_interval: 'month',
      recurring_interval_count: 1,
      trial_interval: 'day',
      trial_interval_count: 14,
      prices: [
        {
          amount_type: 'seat_based',
          price_currency: 'usd',
          tiers: { type: 'volume', tiers: [{ unit_amount: '1000' }] },
        },
        {
          amount_type: 'seat_based',
          price_currency: 'eur',
          tiers: { type: 'volume', tiers: [{ unit_amount: '900' }] },
        },
        {
          amount_type: 'metered_tiers',
          price_currency: 'usd',
          meter_external_id: 'tool_call',
          tiers: {
            type: 'graduated',
            tiers: [{ bound: 1000, unit_amount: '0' }, { unit_amount: '0.1' }],
          },
          cap_amount: 5000,
        },
        {
          amount_type: 'metered_tiers',
          price_currency: 'eur',
          meter_external_id: 'tool_call',
          tiers: {
            type: 'graduated',
            tiers: [{ bound: 1000, unit_amount: '0' }, { unit_amount: '0.09' }],
          },
          cap_amount: 4500,
        },
      ],
      benefit_external_ids: ['custom_servers'],
    },
  ])
})

test('products only reference declared meters and benefits', () => {
  expect(() =>
    defineConfig({
      meters: () => ({}),
      products: ({ product, meter }) => ({
        pro: product()
          // @ts-expect-error unknown meter key
          .prices(meter('unknown').flat().amount(usd(1)))
          .recurring('monthly'),
      }),
    }),
  ).toThrow('Product "pro" references unknown meter "unknown"')
  expect(() =>
    defineConfig({
      meters: () => ({}),
      benefits: ({ flag }) => ({ custom_servers: flag() }),
      products: ({ product, free }) => ({
        pro: product()
          .prices(free())
          .recurring('monthly')
          // @ts-expect-error unknown benefit key
          .grants(['unknown']),
      }),
    }),
  ).toThrow('Product "pro" references unknown benefit "unknown"')
})

test('product names must be between 3 and 64 characters', () => {
  expect(() =>
    defineConfig({
      meters: () => ({}),
      products: ({ product, free }) => ({
        ab: product().prices(free()).once(),
      }),
    }),
  ).toThrow('Provide a name for product "ab"')
})

test('defineConfig rejects fractional price amounts', () => {
  expect(() =>
    defineConfig({
      meters: () => ({}),
      products: ({ product, fixed }) => ({
        pro: product()
          .prices(fixed().amount(usd(9.99)))
          .once(),
      }),
    }),
  ).toThrow()
})
