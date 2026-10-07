import { Effect } from 'effect'
import { expect, test } from 'vitest'
import { parseConfig, validateConfig } from './index'

const countMeter = {
  external_id: 'tool-calls',
  name: 'SDK - Tool Calls',
  filter: {
    conjunction: 'and',
    clauses: [{ property: 'name', operator: 'eq', value: 'Hellooo aladåb' }],
  },
  aggregation: { func: 'count' },
  unit: 'custom',
  custom_label: 'call',
}

const sumMeter = {
  external_id: 'tool-call-tokens',
  name: 'SDK - Tool Call Tokens',
  filter: {
    conjunction: 'and',
    clauses: [
      { property: 'name', operator: 'eq', value: 'tool_call' },
      { property: 'status', operator: 'eq', value: 'ok' },
    ],
  },
  aggregation: { func: 'sum', property: 'tokens' },
  unit: 'token',
}

const config = { meters: [countMeter, sumMeter] }

test('validates parsed config and JSON text without changing values', async () => {
  expect(await Effect.runPromise(validateConfig(config))).toEqual(config)
  expect(await Effect.runPromise(parseConfig(JSON.stringify(config)))).toEqual(
    config,
  )
  expect(await Effect.runPromise(validateConfig({ meters: [] }))).toEqual({
    meters: [],
  })
})

test.each([
  ['invalid conjunction', { ...sumMeter.filter, conjunction: 'qwe' }],
  [
    'invalid operator',
    {
      conjunction: 'and',
      clauses: [{ property: 'name', operator: 'invalid', value: 'tool_call' }],
    },
  ],
  [
    'invalid nested clause',
    {
      conjunction: 'and',
      clauses: [
        {
          conjunction: 'or',
          clauses: [{ property: 'tokens', operator: 'gt', value: null }],
        },
      ],
    },
  ],
  [
    'invalid value',
    {
      conjunction: 'and',
      clauses: [{ property: 'tokens', operator: 'gt', value: null }],
    },
  ],
])('rejects %s', async (_, filter) => {
  await expect(
    Effect.runPromise(validateConfig({ meters: [{ ...sumMeter, filter }] })),
  ).rejects.toThrow()
})

test.each([
  [
    'missing aggregation property',
    { ...sumMeter, aggregation: { func: 'sum' } },
  ],
  ['invalid aggregation', { ...sumMeter, aggregation: { func: 'invalid' } }],
  ['missing custom label', { ...sumMeter, unit: 'custom' }],
  ['custom label on token unit', { ...sumMeter, custom_label: 'call' }],
  ['invalid unit', { ...sumMeter, unit: 'invalid' }],
  ['incorrect field type', { ...sumMeter, external_id: 123 }],
  ['unknown field', { ...sumMeter, unexpected: true }],
])('rejects %s', async (_, meter) => {
  await expect(
    Effect.runPromise(validateConfig({ meters: [meter] })),
  ).rejects.toThrow()
})

test.each([null, [], {}, { meters: 'invalid' }])(
  'rejects invalid config shape %j',
  async (input) => {
    await expect(Effect.runPromise(validateConfig(input))).rejects.toThrow()
  },
)

test('rejects malformed JSON and JSON with invalid meters', async () => {
  await expect(Effect.runPromise(parseConfig('{'))).rejects.toThrow()
  await expect(
    Effect.runPromise(
      parseConfig(
        JSON.stringify({
          meters: [
            { ...sumMeter, filter: { conjunction: 'qwe', clauses: [] } },
          ],
        }),
      ),
    ),
  ).rejects.toThrow()
})
