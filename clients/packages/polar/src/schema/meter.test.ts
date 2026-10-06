import { expect, test } from 'vitest'
import { eq, fold, gte } from './meter'

test('meter builders can be reused without sharing mutable data', () => {
  const base = fold('Tokens', 'llm.completion')
  const filtered = base.where({ tokens: gte(1000) })
  const count = base.count()
  const sum = filtered.unit('custom', 'token').sum('tokens')

  expect(count.filter.clauses).toHaveLength(1)
  expect(count.unit).toBe('scalar')
  expect(sum.filter.clauses).toHaveLength(2)
  expect(sum.unit).toBe('custom')
  Reflect.set(count.filter.clauses, 'length', 0)
  expect(base.count().filter.clauses).toHaveLength(1)
})

test('filter replaces the full filter and copies caller data', () => {
  const filter = {
    conjunction: 'or' as const,
    clauses: [{ property: 'active', ...eq(true) }],
  }
  const builder = fold('Active users', 'user').filter(filter)
  filter.clauses.length = 0
  expect(builder.count().filter).toEqual({
    conjunction: 'or',
    clauses: [{ property: 'active', operator: 'eq', value: true }],
  })
  expect(() => builder.where({ name: eq('other') })).toThrow(
    'where() requires an and filter',
  )
})
