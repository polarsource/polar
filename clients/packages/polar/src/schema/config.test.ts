import { Schema } from 'effect'
import { expect, expectTypeOf, test } from 'vitest'
import { z } from 'zod'
import { RuntimeSDK } from '../runtime'
import { defineConfig } from './config'
import { eq, gte } from './meter'

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
  expectTypeOf(untyped.track).parameter(0).toEqualTypeOf<string>()
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
