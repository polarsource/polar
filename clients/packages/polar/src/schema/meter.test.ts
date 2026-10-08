import { expect, expectTypeOf, test } from 'vitest'
import { z } from 'zod'
import { createEventReferences } from './event'
import { and, eq, gt, gte, like, lt, meter, ne, notLike, or } from './meter'

test('meter builders can be reused without sharing mutable data', () => {
  const base = meter('Tokens').where(eq('name', 'llm.completion'))
  const filtered = base.where(gte('tokens', 1000))
  const count = base.count()
  const sum = filtered.unit('custom', 'token').sum('tokens')

  expect(count.name).toBe('Tokens')
  expect(sum.name).toBe('Tokens')
  expect(count.filter.clauses).toHaveLength(1)
  expect(count.unit).toBe('scalar')
  expect(sum.filter.clauses).toHaveLength(2)
  expect(sum.unit).toBe('custom')
  Reflect.set(count.filter.clauses, 'length', 0)
  expect(base.count().filter.clauses).toHaveLength(1)
})

test('where composes groups while preserving the event, previous conditions, and input isolation', () => {
  const models = or(
    and(eq('model', 'claude'), eq('region', 'eu')),
    and(eq('model', 'gpt'), eq('region', 'us')),
  )
  const builder = meter('Tokens')
    .where(eq('name', 'llm.completion'))
    .where(and(eq('status', 'ok'), models))
  Reflect.set(models.clauses, 'length', 0)
  expect(builder.sum('inputTokens').filter).toEqual({
    conjunction: 'and',
    clauses: [
      { property: 'name', operator: 'eq', value: 'llm.completion' },
      { property: 'status', operator: 'eq', value: 'ok' },
      {
        conjunction: 'or',
        clauses: [
          {
            conjunction: 'and',
            clauses: [
              { property: 'model', operator: 'eq', value: 'claude' },
              { property: 'region', operator: 'eq', value: 'eu' },
            ],
          },
          {
            conjunction: 'and',
            clauses: [
              { property: 'model', operator: 'eq', value: 'gpt' },
              { property: 'region', operator: 'eq', value: 'us' },
            ],
          },
        ],
      },
    ],
  })
})

test('where adds a requirement to an existing OR filter', () => {
  const models = or(eq('model', 'claude'), eq('model', 'gpt'))
  const definition = meter().where(models).where(eq('status', 'ok')).count()
  expect(definition.filter).toEqual({
    conjunction: 'and',
    clauses: [models, { property: 'status', operator: 'eq', value: 'ok' }],
  })
})

const toolCall = z.object({
  tool: z.enum(['search', 'fetch']),
  durationMs: z.int(),
  cached: z.boolean(),
  note: z.string().optional(),
})

const definitions = {
  tool_call: toolCall,
  tool_retry: toolCall,
  heartbeat: z.object({}),
}

const events = createEventReferences(definitions)

test('comparisons on event properties are scoped to their event', () => {
  expect(
    meter().where(eq(events.tool_call.tool, 'search')).count().filter,
  ).toEqual({
    conjunction: 'and',
    clauses: [
      { property: 'name', operator: 'eq', value: 'tool_call' },
      { property: 'tool', operator: 'eq', value: 'search' },
    ],
  })
})

test('single-event meters serialize like hand-written filters', () => {
  const typed = meter<typeof definitions>()
    .on(events.tool_call)
    .where(
      and(
        eq(events.tool_call.tool, 'search'),
        or(gte(events.tool_call.durationMs, 1000), eq('region', 'eu')),
      ),
    )
    .sum('durationMs')
  const untyped = meter()
    .where(eq('name', 'tool_call'))
    .where(
      and(
        eq('tool', 'search'),
        or(gte('durationMs', 1000), eq('region', 'eu')),
      ),
    )
    .sum('durationMs')
  expect(typed).toEqual(untyped)
})

test('multi-event meters keep conditions scoped to the event they reference', () => {
  const definition = meter<typeof definitions>()
    .on([events.tool_call, events.tool_retry])
    .where(or(eq(events.tool_call.cached, false), events.tool_retry))
    .count()
  expect(definition.filter).toEqual({
    conjunction: 'and',
    clauses: [
      {
        conjunction: 'or',
        clauses: [
          { property: 'name', operator: 'eq', value: 'tool_call' },
          { property: 'name', operator: 'eq', value: 'tool_retry' },
        ],
      },
      {
        conjunction: 'or',
        clauses: [
          {
            conjunction: 'and',
            clauses: [
              { property: 'name', operator: 'eq', value: 'tool_call' },
              { property: 'cached', operator: 'eq', value: false },
            ],
          },
          { property: 'name', operator: 'eq', value: 'tool_retry' },
        ],
      },
    ],
  })
})

test('comparisons only accept values and operators that fit the property', () => {
  const typeOnly = () => {
    eq(events.tool_call.tool, 'search')
    ne(events.tool_call.cached, true)
    lt(events.tool_call.durationMs, 10)
    notLike(events.tool_call.note, 'draft')
    // @ts-expect-error not in the enum
    eq(events.tool_call.tool, 'nope')
    // @ts-expect-error durationMs is a number
    eq(events.tool_call.durationMs, '10')
    // @ts-expect-error gt needs a numeric property
    gt(events.tool_call.tool, 1)
    // @ts-expect-error like needs a string property
    like(events.tool_call.durationMs, '1')
    // @ts-expect-error heartbeat has no properties
    eq(events.heartbeat.tool, 'search')
  }
  expectTypeOf(typeOnly).toBeFunction()
})

test('event meters only accept conditions on their own events', () => {
  const builder = meter<typeof definitions>().on(events.tool_call)
  expectTypeOf(builder.sum).parameter(0).toEqualTypeOf<'durationMs'>()
  expectTypeOf(builder.unique)
    .parameter(0)
    .toEqualTypeOf<'tool' | 'durationMs' | 'cached' | 'note'>()
  const typeOnly = () => {
    builder.where(eq(events.tool_call.tool, 'search'))
    builder.where(eq('region', 'eu'))
    // @ts-expect-error tool_retry is not part of this meter
    builder.where(eq(events.tool_retry.tool, 'search'))
    // @ts-expect-error tool_retry is not part of this meter
    builder.where(or(eq(events.tool_call.cached, true), events.tool_retry))
  }
  expectTypeOf(typeOnly).toBeFunction()
})

test('on is only available before a meter is bound or refined', () => {
  const unbound = meter<typeof definitions>()
  const bound = unbound.on(events.tool_call)
  const refined = unbound.where(eq('region', 'eu'))
  expectTypeOf(unbound).toHaveProperty('on')
  expectTypeOf(bound).not.toHaveProperty('on')
  expectTypeOf(refined).not.toHaveProperty('on')
  expectTypeOf(unbound.unit('token')).not.toHaveProperty('on')
  expect('on' in bound).toBe(false)
  expect('on' in refined).toBe(false)
})
