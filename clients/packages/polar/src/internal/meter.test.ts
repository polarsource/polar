import { expect, test } from 'vitest'
import { matchesMeter } from './meter'
import type { MeterAggregation, MeterFilter } from '../schema/meter'

const event = {
  name: 'llm.completion',
  timestamp: new Date('2026-10-01T12:00:00Z'),
  metadata: {
    tokens: 1500,
    status: 'ok',
    active: true,
    _llm: {
      vendor: 'test',
      model: 'test',
      input_tokens: 1500,
      output_tokens: 0,
      total_tokens: 1500,
    },
  },
}

const clauses: [MeterFilter['clauses'][number], boolean][] = [
  [{ property: 'name', operator: 'eq', value: 'llm.completion' }, true],
  [{ property: 'name', operator: 'eq', value: 'other' }, false],
  [{ property: 'status', operator: 'ne', value: 'failed' }, true],
  [{ property: 'tokens', operator: 'gt', value: 1000 }, true],
  [{ property: 'tokens', operator: 'gte', value: 1500 }, true],
  [{ property: 'tokens', operator: 'lt', value: 1000 }, false],
  [{ property: 'tokens', operator: 'lte', value: 1500 }, true],
  [{ property: 'name', operator: 'like', value: 'completion' }, true],
  [{ property: 'name', operator: 'not_like', value: 'embedding' }, true],
  [{ property: 'active', operator: 'eq', value: true }, true],
  [{ property: 'active', operator: 'eq', value: 1 }, true],
  [{ property: 'tokens', operator: 'gte', value: '1000' }, false],
  [{ property: 'missing', operator: 'ne', value: 'anything' }, false],
  [{ property: 'constructor', operator: 'eq', value: 'anything' }, false],
  [
    { property: 'metadata._llm.input_tokens', operator: 'eq', value: 1500 },
    true,
  ],
  [{ property: 'source', operator: 'eq', value: 'user' }, true],
  [
    {
      property: 'timestamp',
      operator: 'eq',
      value: event.timestamp.getTime() / 1000,
    },
    true,
  ],
]

test.each(clauses)('matches clause %j like the backend', (clause, expected) => {
  expect(
    matchesMeter(
      {
        filter: { conjunction: 'and', clauses: [clause] },
        aggregation: { func: 'count' },
      },
      event,
    ),
  ).toBe(expected)
})

test('handles flat, nested, and empty conjunctions', () => {
  const yes = { property: 'status', operator: 'eq' as const, value: 'ok' }
  const no = { ...yes, value: 'failed' }
  const aggregation = { func: 'count' as const }
  expect(
    matchesMeter(
      { aggregation, filter: { conjunction: 'or', clauses: [no, yes] } },
      event,
    ),
  ).toBe(true)
  expect(
    matchesMeter(
      { aggregation, filter: { conjunction: 'and', clauses: [no, yes] } },
      event,
    ),
  ).toBe(false)
  expect(
    matchesMeter(
      {
        aggregation,
        filter: {
          conjunction: 'and',
          clauses: [{ conjunction: 'or', clauses: [no, yes] }],
        },
      },
      event,
    ),
  ).toBe(true)
  for (const conjunction of ['and', 'or'] as const) {
    expect(
      matchesMeter(
        { aggregation, filter: { conjunction, clauses: [] } },
        event,
      ),
    ).toBe(true)
  }
})

test.each(['sum', 'unique'] as const)('handles %s aggregation', (func) => {
  const filter = { conjunction: 'and' as const, clauses: [] }
  const aggregation: MeterAggregation = { func, property: 'tokens' }
  expect(matchesMeter({ filter, aggregation }, event)).toBe(true)
  expect(
    matchesMeter({ filter, aggregation: { func, property: 'missing' } }, event),
  ).toBe(func === 'unique')
})
