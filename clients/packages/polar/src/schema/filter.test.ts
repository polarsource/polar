import { describe, expect, it } from 'vitest'
import { SchemaError } from './error'
import {
  and,
  eq,
  gt,
  gte,
  like,
  lt,
  lte,
  ne,
  notLike,
  or,
  toFilter,
} from './filter'

describe('filter', () => {
  it('names each operator', () => {
    expect([
      eq('name', 'llm.completion'),
      ne('model', 'gpt'),
      gt('tokens', 1),
      gte('tokens', 2),
      lt('tokens', 3),
      lte('tokens', 4),
      like('model', 'claude%'),
      notLike('model', 'gpt%'),
    ]).toEqual([
      { property: 'name', operator: 'eq', value: 'llm.completion' },
      { property: 'model', operator: 'ne', value: 'gpt' },
      { property: 'tokens', operator: 'gt', value: 1 },
      { property: 'tokens', operator: 'gte', value: 2 },
      { property: 'tokens', operator: 'lt', value: 3 },
      { property: 'tokens', operator: 'lte', value: 4 },
      { property: 'model', operator: 'like', value: 'claude%' },
      { property: 'model', operator: 'not_like', value: 'gpt%' },
    ])
  })

  it('builds a comparison without a property', () => {
    expect([gt(5), like('claude%'), ne('gpt')]).toEqual([
      { operator: 'gt', value: 5 },
      { operator: 'like', value: 'claude%' },
      { operator: 'ne', value: 'gpt' },
    ])
  })

  it('nests a disjunction', () => {
    expect(
      and(
        eq('name', 'llm.completion'),
        or(eq('model', 'gpt'), eq('model', 'claude')),
      ),
    ).toEqual({
      conjunction: 'and',
      clauses: [
        { property: 'name', operator: 'eq', value: 'llm.completion' },
        {
          conjunction: 'or',
          clauses: [
            { property: 'model', operator: 'eq', value: 'gpt' },
            { property: 'model', operator: 'eq', value: 'claude' },
          ],
        },
      ],
    })
  })

  it('wraps a single clause in a conjunction', () => {
    const clause = eq('name', 'tool.call')
    const filter = or(clause)

    expect(toFilter(clause)).toEqual({ conjunction: 'and', clauses: [clause] })
    expect(toFilter(filter)).toBe(filter)
  })

  it('restricts comparison values by operator', () => {
    // @ts-expect-error gt compares numbers
    const comparesString = () => gt('tokens', 'many')
    // @ts-expect-error like matches strings
    const matchesNumber = () => like('model', 1)

    expect(comparesString).not.toThrow()
    expect(matchesNumber).not.toThrow()
  })

  it('rejects a value polar cannot store', () => {
    const tooLong = () => eq('name', 'x'.repeat(1001))
    const fraction = () => gt('tokens', 1.5)

    expect(tooLong).toThrow(SchemaError)
    expect(tooLong).toThrow('filter: value is longer than 1000 characters')
    expect(fraction).toThrow(
      'filter: value must be a string, 32-bit integer, or boolean, got 1.5',
    )
  })
})
