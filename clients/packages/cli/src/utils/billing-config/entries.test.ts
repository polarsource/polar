import { describe, expect, test } from 'vitest'
import { TO_DO, formatRows, tally } from '@/utils/billing-config/entries'
import { stripAnsi } from '@/utils/test-utils/cli'

const fixed = (price_currency: string, price_amount: number) => ({
  amount_type: 'fixed',
  price_currency,
  price_amount,
})

const metered = (price_currency: string, unit_amount: string) => ({
  amount_type: 'metered_unit',
  price_currency,
  meter: 'tool_call',
  unit_amount,
  cap_amount: 10000,
})

describe('formatRows', () => {
  test('aligns the fields of a created entry', () => {
    const output = stripAnsi(
      formatRows(
        '  ',
        [
          { field: 'name', before: null, after: 'Tool calls' },
          { field: 'aggregation', before: null, after: { func: 'count' } },
        ],
        'created',
      ).join('\n'),
    )
    expect(output).toBe(
      ['  name         "Tool calls"', '  aggregation  count'].join('\n'),
    )
  })

  test('shows before and after inline, or as a block when either spans lines', () => {
    const output = stripAnsi(
      formatRows(
        '',
        [
          { field: 'name', before: 'Old', after: 'New' },
          { field: 'unit', before: 'scalar', after: null },
          {
            field: 'filter',
            before: { conjunction: 'and', clauses: [] },
            after: {
              conjunction: 'and',
              clauses: [
                { property: 'name', operator: 'eq', value: 'x' },
                { property: 'ok', operator: 'eq', value: true },
              ],
            },
          },
        ],
        'updated',
      ).join('\n'),
    )
    expect(output).toBe(
      [
        'name    "Old" → "New"',
        'unit    "scalar" → unset',
        'filter',
        '  - all events',
        '  + name = "x"',
        '    AND ok = true',
      ].join('\n'),
    )
  })

  test('merges the recurrence and splits a price list into one row per kind', () => {
    const output = stripAnsi(
      formatRows(
        '',
        [
          { field: 'recurring_interval', before: 'month', after: 'year' },
          { field: 'recurring_interval_count', before: 3, after: 1 },
          {
            field: 'prices',
            before: [fixed('usd', 999)],
            after: [
              fixed('usd', 1999),
              fixed('eur', 1799),
              metered('usd', '10'),
            ],
          },
        ],
        'updated',
      ).join('\n'),
    )
    expect(output).toBe(
      [
        'recurrence                  per 3 months → per year',
        'prices (USD)                $9.99 → $19.99',
        'prices (EUR)                unset → €17.99',
        'prices (USD per tool_call)',
        '  - unset',
        '  + $0.10',
        '    capped at $100',
      ].join('\n'),
    )
  })

  test('strips control characters from field names', () => {
    const output = stripAnsi(
      formatRows(
        '',
        [{ field: 'na\u0007me', before: null, after: 'x' }],
        'created',
      ).join('\n'),
    )
    expect(output).toBe('name  "x"')
  })
})

describe('tally', () => {
  test('counts entries per action with the given labels', () => {
    const entries = [
      { section: 'meters', id: 'a', action: 'created' as const, diff: [] },
      { section: 'meters', id: 'b', action: 'created' as const, diff: [] },
      { section: 'meters', id: 'c', action: 'unchanged' as const, diff: [] },
    ]
    expect(stripAnsi(tally(entries))).toBe('2 created, 0 updated, 1 unchanged')
    expect(stripAnsi(tally(entries, TO_DO))).toBe(
      '2 to create, 0 to update, 1 unchanged',
    )
  })
})
