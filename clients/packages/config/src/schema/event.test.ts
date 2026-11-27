import type { StandardSchemaV1 } from '@standard-schema/spec'
import { expect, expectTypeOf, test } from 'vitest'
import { z } from 'zod'
import { event, type EventInput, type LLMMetadata } from './event'

const usage = {
  vendor: 'openai',
  model: 'gpt-4o',
  input_tokens: 10,
  output_tokens: 5,
  total_tokens: 15,
}

const validate = (schema: StandardSchemaV1, value: unknown) =>
  Promise.resolve(schema['~standard'].validate(value))

test('withTokens and withCosts add _llm and _cost in any order', async () => {
  const completion = event(z.object({ feature: z.string() }))
    .withTokens()
    .withCosts()
  expectTypeOf<EventInput<typeof completion>>().toEqualTypeOf<{
    feature: string
    readonly _llm: LLMMetadata
    readonly _cost: { readonly amount: number; readonly currency: 'usd' }
  }>()

  const metadata = {
    feature: 'chat',
    _llm: usage,
    _cost: { amount: 0.25, currency: 'usd' },
  }
  await expect(validate(completion, metadata)).resolves.toEqual({
    value: metadata,
  })
  await expect(
    validate(
      event(z.object({ feature: z.string() }))
        .withCosts()
        .withTokens(),
      metadata,
    ),
  ).resolves.toEqual({ value: metadata })
})

test('declared usage is required and validated', async () => {
  const completion = event().withTokens()
  await expect(validate(completion, { _llm: usage })).resolves.toEqual({
    value: { _llm: usage },
  })
  const missing = await validate(completion, {})
  expect(missing.issues?.[0]?.path).toEqual(['_llm'])
  const invalid = await validate(completion, {
    _llm: { ...usage, total_tokens: 1.5 },
  })
  expect(invalid.issues?.[0]?.path).toEqual(['_llm', 'total_tokens'])
  const cost = await validate(event().withCosts(), {
    _cost: { amount: 1, currency: 'eur' },
  })
  expect(cost.issues?.[0]?.path).toEqual(['_cost', 'currency'])
})

test('cost amounts fit the API decimal limits', async () => {
  const amount = async (value: number) =>
    (
      await validate(event().withCosts(), {
        _cost: { amount: value, currency: 'usd' },
      })
    ).issues?.[0]?.path
  for (const valid of [0.1, 99_999.123456789, 1e-12, -5, 0]) {
    expect(await amount(valid)).toBeUndefined()
  }
  for (const invalid of [0.1 + 0.2, 1e-13, 100_000, 1e20, -100_000]) {
    expect(await amount(invalid)).toEqual(['_cost', 'amount'])
  }
})

test('reports issues from the event schema and usage together', async () => {
  const result = await validate(
    event(z.object({ feature: z.string() })).withTokens(),
    { feature: 1 },
  )
  expect(result.issues?.map(({ path }) => path?.[0])).toEqual([
    'feature',
    '_llm',
  ])
})

test('supports async event schemas', async () => {
  const schema = z.object({ feature: z.string() }).refine(async () => true)
  const result = validate(event(schema).withTokens(), {
    feature: 'chat',
    _llm: usage,
  })
  await expect(result).resolves.toEqual({
    value: { feature: 'chat', _llm: usage },
  })
})

test('events without usage only run their own schema', async () => {
  await expect(
    validate(event(z.object({ feature: z.string() })), {
      feature: 'chat',
      _llm: usage,
    }),
  ).resolves.toEqual({ value: { feature: 'chat' } })
  await expect(validate(event(), { anything: 1 })).resolves.toEqual({
    value: {},
  })
})
