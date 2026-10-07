import { expect, test } from 'vitest'
import { and, eq, gte, meter, or } from './meter'

test('meter builders can be reused without sharing mutable data', () => {
  const base = meter().displayName('Tokens').where(eq('name', 'llm.completion'))
  const filtered = base
    .displayName('Filtered Tokens')
    .where(gte('tokens', 1000))
  const count = base.count()
  const sum = filtered.unit('custom', 'token').sum('tokens')

  expect(count.name).toBe('Tokens')
  expect(sum.name).toBe('Filtered Tokens')
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
  const builder = meter()
    .displayName('Tokens')
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
