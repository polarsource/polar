import { expect, expectTypeOf, test } from 'vitest'
import { RuntimeSDK } from '../runtime'
import { defineConfig } from './config'
import { gte } from './meter'

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
