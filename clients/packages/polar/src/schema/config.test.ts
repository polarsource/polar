import { Schema } from 'effect'
import { expect, expectTypeOf, test } from 'vitest'
import { z } from 'zod'
import { RuntimeSDK } from '../runtime'
import { flag } from './benefit'
import { defineConfig } from './config'
import { eq, gte } from './meter'
import { eur, perThousand, usd } from './money'

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

test('defineConfig passes settings through', () => {
  const config = defineConfig({
    settings: { payments: { currency: 'eur', tax: 'inclusive' } },
    meters: ({ meter }) => ({ tokens: meter().count() }),
  })
  expect(config.toJSON().settings).toEqual({
    payments: { currency: 'eur', tax: 'inclusive' },
  })
  expect(
    'settings' in
      defineConfig({
        meters: ({ meter }) => ({ tokens: meter().count() }),
      }).toJSON(),
  ).toBe(false)
})

test('free prices use the settings currency', () => {
  const prices = (settings?: { payments: { currency: 'eur' } }) =>
    defineConfig({
      ...(settings && { settings }),
      meters: ({ meter }) => ({ tokens: meter().count() }),
      products: ({ product, free }) => ({
        free: product('Free').prices(free()).recurring('monthly'),
      }),
    }).toJSON().products?.[0]?.prices

  expect(prices({ payments: { currency: 'eur' } })).toEqual([
    { amount_type: 'fixed', price_currency: 'eur', price_amount: 0 },
  ])
  expect(prices()).toEqual([
    { amount_type: 'fixed', price_currency: 'usd', price_amount: 0 },
  ])
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

const events = {
  tool_call: z.object({
    tool: z.enum(['search', 'fetch']),
    durationMs: z.int(),
  }),
  'llm.completion': Schema.toStandardSchemaV1(
    Schema.Struct({ model: Schema.String, inputTokens: Schema.Int }),
  ),
  'llm.embedding': z.object({
    model: z.string(),
    inputTokens: z.int(),
    dimensions: z.int(),
  }),
}

test('meters reference declared events and serialize without them', () => {
  const config = defineConfig({
    events,
    meters: ({ meter, events }) => ({
      searches: meter()
        .on(events.tool_call)
        .where(eq(events.tool_call.tool, 'search'))
        .count(),
      llm_tokens: meter('LLM tokens')
        .on(events['llm.completion'], events['llm.embedding'])
        .sum('inputTokens'),
      requests: meter('Requests').where(eq('name', 'api.request')).count(),
    }),
  })

  expect(config.toJSON()).toEqual({
    meters: [
      {
        external_id: 'searches',
        name: 'searches',
        unit: 'scalar',
        filter: {
          conjunction: 'and',
          clauses: [
            { property: 'name', operator: 'eq', value: 'tool_call' },
            { property: 'tool', operator: 'eq', value: 'search' },
          ],
        },
        aggregation: { func: 'count' },
      },
      {
        external_id: 'llm_tokens',
        name: 'LLM tokens',
        unit: 'scalar',
        filter: {
          conjunction: 'or',
          clauses: [
            { property: 'name', operator: 'eq', value: 'llm.completion' },
            { property: 'name', operator: 'eq', value: 'llm.embedding' },
          ],
        },
        aggregation: { func: 'sum', property: 'inputTokens' },
      },
      {
        external_id: 'requests',
        name: 'Requests',
        unit: 'scalar',
        filter: {
          conjunction: 'and',
          clauses: [{ property: 'name', operator: 'eq', value: 'api.request' }],
        },
        aggregation: { func: 'count' },
      },
    ],
  })
})

test('meter only accepts declared events and properties they share', () => {
  const typeOnly = () =>
    defineConfig({
      events,
      meters: ({ meter, events }) => {
        expectTypeOf(meter().on(events['llm.embedding']).sum)
          .parameter(0)
          .toEqualTypeOf<'inputTokens' | 'dimensions'>()
        expectTypeOf(
          meter().on(events['llm.completion'], events['llm.embedding']).sum,
        )
          .parameter(0)
          .toEqualTypeOf<'inputTokens'>()
        return {
          // @ts-expect-error undeclared event
          unknown: meter().on(events.nope).count(),
          // @ts-expect-error event names are not references
          name: meter().on('tool_call').count(),
          // @ts-expect-error a meter needs at least one event
          empty: meter().on().count(),
        }
      },
    })
  expectTypeOf(typeOnly).toBeFunction()
})

test('meter rejects undeclared events and plain names at runtime', () => {
  const define = (target: (events: object) => unknown[]) => () =>
    defineConfig({
      events,
      meters: ({ meter, events }) => ({
        calls: meter()
          .on(...(target(events) as [never]))
          .count(),
      }),
    })
  expect(define((events) => [Reflect.get(events, 'nope')])).toThrow(
    'Unknown event "nope"',
  )
  expect(define((events) => [Reflect.get(events, 'toString')])).toThrow(
    'Unknown event "toString"',
  )
  expect(define(() => [])).toThrow('takes one or more events')
  expect(define(() => ['tool_call'])).toThrow('takes one or more events')
  expect(define((events) => [[Reflect.get(events, 'tool_call')]])).toThrow(
    'takes one or more events',
  )
})

test('events must have flat metadata without reserved properties', () => {
  defineConfig({
    // @ts-expect-error nested objects are not valid metadata
    events: { nested: z.object({ request: z.object({ id: z.string() }) }) },
    meters: () => ({}),
  })
  defineConfig({
    // @ts-expect-error metadata values cannot be null
    events: { nullable: z.object({ note: z.string().nullable() }) },
    meters: () => ({}),
  })
  defineConfig({
    // @ts-expect-error name is a reserved property
    events: { reserved: z.object({ name: z.string() }) },
    meters: () => ({}),
  })
  defineConfig({
    // @ts-expect-error metadata must be an object
    events: { scalar: z.string() },
    meters: () => ({}),
  })
  defineConfig({
    // @ts-expect-error _cost must match the cost metadata shape
    events: { priced: z.object({ _cost: z.object({ amount: z.string() }) }) },
    meters: () => ({}),
  })
  defineConfig({
    events: {
      priced: z.object({
        tokens: z.int(),
        _cost: z.object({ amount: z.number(), currency: z.literal('usd') }),
      }),
    },
    meters: () => ({}),
  })
})

test('connected configs type and validate track with the declared event schemas', async () => {
  const config = defineConfig({
    events,
    meters: ({ meter, events }) => ({
      searches: meter().on(events.tool_call).count(),
    }),
  })
  const customer = RuntimeSDK(config, { accessToken: 'test' }).actor({
    customerId: 'customer-1',
  })

  expectTypeOf(customer.track<'tool_call'>)
    .parameter(1)
    .toEqualTypeOf<{ tool: 'search' | 'fetch'; durationMs: number }>()
  expectTypeOf(customer.track)
    .parameter(0)
    .extract<string>()
    .toEqualTypeOf<'tool_call' | 'llm.completion' | 'llm.embedding'>()
  await expect(
    customer.track('tool_call', { tool: 'search', durationMs: 1.5 }),
  ).rejects.toThrow('Invalid metadata for event "tool_call"')

  const untyped = RuntimeSDK(
    defineConfig({
      meters: ({ meter }) => ({ calls: meter('Calls').count() }),
    }),
    { accessToken: 'test' },
  ).actor({ customerId: 'customer-1' })
  expectTypeOf(untyped.track)
    .parameter(0)
    .extract<string>()
    .toEqualTypeOf<string>()
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
    },
    {
      external_id: 'tool_calls',
      type: 'meter_credit',
      description: 'tool_calls',
      properties: {
        meter: 'tool_call',
        units: 100,
        rollover: false,
      },
    },
    {
      external_id: 'rollover_calls',
      type: 'meter_credit',
      description: 'Rollover tool calls',
      properties: {
        meter: 'tool_call',
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
    products: ({ product, seats, tier, meter }) => ({
      pro: product('Pro')
        .prices(
          seats().flat().amount(usd(10), eur(9)),
          meter('tool_call')
            .graduated(
              tier().max(1000).amount(usd(0), eur(0)),
              tier().amount(perThousand(usd(1)), perThousand(eur(0.9))),
            )
            .cap(usd(50), eur(45)),
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
          meter: 'tool_call',
          tiers: {
            type: 'graduated',
            tiers: [{ bound: 1000, unit_amount: '0' }, { unit_amount: '0.1' }],
          },
          cap_amount: 5000,
        },
        {
          amount_type: 'metered_tiers',
          price_currency: 'eur',
          meter: 'tool_call',
          tiers: {
            type: 'graduated',
            tiers: [{ bound: 1000, unit_amount: '0' }, { unit_amount: '0.09' }],
          },
          cap_amount: 4500,
        },
      ],
      benefits: ['custom_servers'],
    },
  ])
})

test('product description and visibility are only sent when set', () => {
  const config = defineConfig({
    meters: () => ({}),
    products: ({ product, free }) => ({
      beta: product('Beta')
        .prices(free())
        .recurring('monthly')
        .description('Early access')
        .private(),
      pro: product('Pro').prices(free()).recurring('monthly'),
    }),
  })
  const [beta, pro] = config.toJSON().products ?? []
  expect(beta).toMatchObject({
    description: 'Early access',
    visibility: 'private',
  })
  expect(pro).not.toHaveProperty('description')
  expect(pro).not.toHaveProperty('visibility')
})

test('benefits are public unless made private', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({ calls: meter('Calls').count() }),
    benefits: ({ flag, credits }) => ({
      beta: flag('Beta').private().metadata({ tier: 'pro' }),
      calls: credits('Calls').meter('calls').units(10).private().rollover(),
      open: flag('Open'),
      reset: flag('Reset').private().public(),
    }),
  })
  const [beta, calls, open, reset] = config.toJSON().benefits ?? []
  expect(beta).toMatchObject({
    visibility: 'private',
    metadata: { tier: 'pro' },
  })
  expect(calls).toMatchObject({
    visibility: 'private',
    properties: { rollover: true },
  })
  expect(open).not.toHaveProperty('visibility')
  expect(reset).not.toHaveProperty('visibility')
})

test('products only reference declared meters and benefits', () => {
  expect(() =>
    defineConfig({
      meters: () => ({}),
      products: ({ product, meter }) => ({
        pro: product()
          // @ts-expect-error unknown meter key
          .prices(meter('unknown').flat().amount(usd(0.01)))
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

test('deprecated meters stay in the config and the client', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({
      apples: meter('Apples').deprecated().count(),
      pears: meter('Pears').count(),
    }),
    products: ({ product, meter }) => ({
      pro: product()
        .prices(meter('pears').flat().amount(usd(0.01)))
        .recurring('monthly'),
    }),
  })
  const [apples, pears] = config.toJSON().meters
  expect(apples).toMatchObject({ external_id: 'apples', deprecated: true })
  expect(pears).not.toHaveProperty('deprecated')
  expectTypeOf(
    RuntimeSDK(config, { accessToken: 'test' }).actor({ customerId: 'c' })
      .balance,
  )
    .parameter(0)
    .toEqualTypeOf<'apples' | 'pears'>()
})

test('active products and benefits cannot use a deprecated meter', () => {
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({ apples: meter().deprecated().count() }),
      products: ({ product, meter }) => ({
        // @ts-expect-error pro is active, so it cannot price by apples
        pro: product()
          .prices(meter('apples').flat().amount(usd(0.01)))
          .recurring('monthly'),
      }),
    }),
  ).toThrow(
    'Product "pro" uses meter "apples", which is deprecated. Undeprecate the meter or create a new one.',
  )
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({ apples: meter().deprecated().count() }),
      benefits: ({ credits }) => ({
        // @ts-expect-error included is active, so it cannot use apples
        included: credits('Included apples').meter('apples').units(10),
      }),
    }),
  ).toThrow('Benefit "included" uses meter "apples", which is deprecated.')
})

test('deprecating a meter anywhere in its chain marks it deprecated', () => {
  const events = { call: z.object({ ok: z.boolean() }) }
  expect(() =>
    defineConfig({
      events,
      meters: ({ meter, events }) => ({
        apples: meter().deprecated().on(events.call).unit('token').count(),
      }),
      benefits: ({ credits }) => [
        // @ts-expect-error included is active, so it cannot use apples
        ['included', credits('Apples').meter('apples').units(10)],
      ],
    }),
  ).toThrow('Benefit "included" uses meter "apples", which is deprecated.')
  expect(() =>
    defineConfig({
      events,
      meters: ({ meter, events }) => ({
        pears: meter()
          .on(events.call)
          .where(eq('ok', true))
          .deprecated()
          .count(),
      }),
      benefits: ({ credits }) => ({
        // @ts-expect-error included is active, so it cannot use pears
        included: credits('Pears').meter('pears').units(10),
      }),
    }),
  ).toThrow('Benefit "included" uses meter "pears", which is deprecated.')
  expect(() =>
    defineConfig({
      events,
      meters: ({ meter, events }) => ({
        plums: meter().on(events.call).count().deprecated(),
      }),
      benefits: ({ credits }) => ({
        // @ts-expect-error included is active, so it cannot use plums
        included: credits('Plums').meter('plums').units(10),
      }),
    }),
  ).toThrow('Benefit "included" uses meter "plums", which is deprecated.')
})

test('deprecated benefits stay in the config', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({ calls: meter('Calls').count() }),
    benefits: ({ flag, credits }) => ({
      beta: flag('Beta').deprecated(),
      calls: credits('Calls').meter('calls').units(10).deprecated(),
      support: flag('Support'),
    }),
    products: ({ product, free }) => ({
      pro: product().prices(free()).recurring('monthly').grants(['support']),
    }),
  })
  const [beta, calls, support] = config.toJSON().benefits ?? []
  expect(beta).toMatchObject({ external_id: 'beta', deprecated: true })
  expect(calls).toMatchObject({ external_id: 'calls', deprecated: true })
  expect(support).not.toHaveProperty('deprecated')
})

test('deprecated benefits can use a deprecated meter', () => {
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({ apples: meter().deprecated().count() }),
      benefits: ({ credits }) => ({
        included: credits('Included apples')
          .meter('apples')
          .units(10)
          .deprecated(),
      }),
    }),
  ).not.toThrow()
})

test('deprecated products can use deprecated meters and benefits', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({ apples: meter().deprecated().count() }),
    benefits: ({ flag }) => ({ beta: flag('Beta').deprecated() }),
    products: ({ product, meter, free }) => ({
      legacy: product()
        .prices(meter('apples').flat().amount(usd(0.01)))
        .recurring('monthly')
        .grants(['beta'])
        .deprecated(),
      pro: product().prices(free()).recurring('monthly'),
    }),
  })
  const [legacy, pro] = config.toJSON().products ?? []
  expect(legacy).toMatchObject({ external_id: 'legacy', deprecated: true })
  expect(pro).not.toHaveProperty('deprecated')
})

test('a product deprecated anywhere in its chain can price by a deprecated meter', () => {
  defineConfig({
    meters: ({ meter }) => ({
      apples: meter().deprecated().count(),
      pears: meter().count(),
    }),
    products: ({ product, fixed, meter }) => ({
      legacy: product()
        .deprecated()
        .prices(
          fixed().amount(usd(10)),
          meter('pears').flat().amount(usd(0.01)),
          meter('apples').flat().amount(usd(0.02)),
        )
        .recurring('monthly'),
      pro: product()
        .prices(
          fixed().amount(usd(10)),
          meter('pears').flat().amount(usd(0.01)),
        )
        .recurring('monthly'),
    }),
  })
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({
        apples: meter().deprecated().count(),
        pears: meter().count(),
      }),
      products: ({ product, fixed, meter }) => [
        [
          'pro',
          // @ts-expect-error pro is active, so it cannot price by apples
          product()
            .prices(
              fixed().amount(usd(10)),
              meter('pears').flat().amount(usd(0.01)),
              meter('apples').flat().amount(usd(0.02)),
            )
            .recurring('monthly'),
        ],
      ],
    }),
  ).toThrow('Product "pro" uses meter "apples", which is deprecated.')
})

test('active products cannot grant a deprecated benefit', () => {
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({ calls: meter().count() }),
      benefits: ({ flag }) => ({ beta: flag('Beta').deprecated() }),
      products: ({ product, free }) => ({
        // @ts-expect-error pro is active, so it cannot grant beta
        pro: product().prices(free()).recurring('monthly').grants(['beta']),
      }),
    }),
  ).toThrow(
    'Product "pro" uses benefit "beta", which is deprecated. Undeprecate the benefit or create a new one.',
  )
})

test('deprecating a product after or before grants() allows deprecated benefits', () => {
  defineConfig({
    meters: () => ({}),
    benefits: ({ flag }) => ({
      beta: flag('Beta').deprecated(),
      support: flag('Support'),
    }),
    products: ({ product, free }) => ({
      legacy: product()
        .prices(free())
        .recurring('monthly')
        .grants(['beta'])
        .deprecated(),
      older: product()
        .deprecated()
        .prices(free())
        .recurring('monthly')
        .grants(['beta', 'support']),
      pro: product().prices(free()).recurring('monthly').grants(['support']),
    }),
  })
  expect(() =>
    defineConfig({
      meters: () => ({}),
      benefits: ({ flag }) => [['beta', flag('Beta').deprecated()]],
      products: ({ product, free }) => [
        // @ts-expect-error pro is active, so it cannot grant beta
        ['pro', product().prices(free()).recurring('monthly').grants(['beta'])],
      ],
    }),
  ).toThrow('Product "pro" uses benefit "beta", which is deprecated.')
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

test('defineConfig rejects amounts with more decimals than the currency', () => {
  const amount = (value: number) => value
  expect(() =>
    defineConfig({
      meters: () => ({}),
      products: ({ product, fixed }) => ({
        pro: product()
          .prices(fixed().amount(usd(amount(9.999))))
          .once(),
      }),
    }),
  ).toThrow()
})

test('webhooks serialize with their format, events and pinned API version', () => {
  const config = defineConfig({
    meters: () => ({}),
    webhooks: ({ endpoint, slack, discord }) => ({
      app: endpoint('https://app.test/api/polar/webhooks')
        .on('order.paid', 'subscription.canceled')
        .handle(async () => () => {}),
      sales: slack('https://hooks.slack.com/services/T0/B0/token').on(
        'order.paid',
      ),
      ops: discord('https://discord.com/api/webhooks/1/token').on(
        'subscription.revoked',
      ),
    }),
  })
  expect(config.toJSON().webhooks).toEqual([
    {
      external_id: 'app',
      url: 'https://app.test/api/polar/webhooks',
      format: 'raw',
      events: ['order.paid', 'subscription.canceled'],
      api_version: '2027-01',
    },
    {
      external_id: 'sales',
      url: 'https://hooks.slack.com/services/T0/B0/token',
      format: 'slack',
      events: ['order.paid'],
      api_version: '2027-01',
    },
    {
      external_id: 'ops',
      url: 'https://discord.com/api/webhooks/1/token',
      format: 'discord',
      events: ['subscription.revoked'],
      api_version: '2027-01',
    },
  ])
})

test('webhooks with handlers must each read a different secret', () => {
  const handler = async () => () => {}
  expect(() =>
    defineConfig({
      meters: () => ({}),
      webhooks: ({ endpoint }) => ({
        app: endpoint('https://app.test/a').on('order.paid').handle(handler),
        billing: endpoint('https://app.test/b')
          .on('order.paid')
          .handle(handler),
      }),
    }),
  ).toThrow('more than one reads POLAR_WEBHOOK_SECRET')
  expect(() =>
    defineConfig({
      meters: () => ({}),
      webhooks: ({ endpoint }) => ({
        app: endpoint('https://app.test/a').on('order.paid').handle(handler),
        billing: endpoint('https://app.test/b')
          .on('order.paid')
          .secret('BILLING_WEBHOOK_SECRET')
          .handle(handler),
        unhandled: endpoint('https://app.test/c').on('order.paid'),
      }),
    }),
  ).not.toThrow()
})

test('meters, benefits and products serialize their metadata', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({
      calls: meter('Calls').metadata({ team: 'search' }).count(),
      tokens: meter('Tokens').where(gte('tokens', 1)).count(),
    }),
    benefits: ({ flag, credits }) => ({
      custom_servers: flag('Custom servers').metadata({ limit: 5 }),
      tool_calls: credits('Tool calls')
        .meter('calls')
        .units(100)
        .metadata({ visible: true })
        .rollover(),
    }),
    products: ({ product, free }) => ({
      pro: product('Pro')
        .metadata({ plan: 'pro', rank: 2 })
        .prices(free())
        .recurring('monthly')
        .grants(['custom_servers']),
    }),
  })
  const json = config.toJSON()
  expect(json.meters.map((meter) => meter.metadata)).toEqual([
    { team: 'search' },
    undefined,
  ])
  expect(json.meters[1]).not.toHaveProperty('metadata')
  expect(json.benefits?.map((benefit) => benefit.metadata)).toEqual([
    { limit: 5 },
    { visible: true },
  ])
  expect(json.products?.[0]?.metadata).toEqual({ plan: 'pro', rank: 2 })
})

test('metadata can only be declared once per builder', () => {
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({
        calls: meter('Calls')
          .metadata({ a: 1 })
          .where(gte('tokens', 1))
          .metadata({ b: 2 })
          .count(),
      }),
    }),
  ).toThrow('metadata() can only be called once per builder.')
  expect(() =>
    flag('Beta').metadata({ a: 1 }).private().metadata({ b: true }),
  ).toThrow('metadata() can only be called once per builder.')
  expect(() =>
    defineConfig({
      meters: () => ({}),
      products: ({ product, free }) => ({
        pro: product('Pro')
          .metadata({ a: 1 })
          .prices(free())
          .recurring('monthly')
          .metadata({ b: true }),
      }),
    }),
  ).toThrow('metadata() can only be called once per builder.')
})

test('metadata follows the API limits', () => {
  const withMetadata = (metadata: Record<string, string | number | boolean>) =>
    defineConfig({
      meters: ({ meter }) => ({ calls: meter().metadata(metadata).count() }),
    })

  expect(() => withMetadata({ ['k'.repeat(41)]: 'value' })).toThrow()
  expect(() => withMetadata({ '': 'value' })).toThrow()
  expect(() => withMetadata({ key: '' })).toThrow()
  expect(() => withMetadata({ key: 'v'.repeat(501) })).toThrow()
  expect(() => withMetadata({ key: Number.NaN })).toThrow()
  expect(() =>
    withMetadata(
      Object.fromEntries(
        Array.from({ length: 51 }, (_, index) => [`key${index}`, index]),
      ),
    ),
  ).toThrow()
  expect(
    withMetadata(
      Object.fromEntries(
        Array.from({ length: 50 }, (_, index) => [`key${index}`, index]),
      ),
    ).toJSON().meters[0]?.metadata,
  ).toHaveProperty('key49', 49)
})
