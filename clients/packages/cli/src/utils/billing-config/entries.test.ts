import { describe, expect, test } from 'vitest'
import {
  formatRows,
  lineDiff,
  planSummary,
  tally,
} from '@/utils/billing-config/entries'
import { stripAnsi } from '@/utils/test-utils/cli'
import * as ui from '@/utils/ui'

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
        '  + AND ok = true',
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
        '  + capped at $100',
      ].join('\n'),
    )
  })

  test('leaves out price groups that did not change', () => {
    const output = stripAnsi(
      formatRows(
        '',
        [
          {
            field: 'prices',
            before: [fixed('usd', 4900), metered('eur', '0.18')],
            after: [fixed('usd', 4900), metered('eur', '0.2')],
          },
        ],
        'updated',
      ).join('\n'),
    )
    expect(output).not.toContain('prices (USD)')
    expect(output).toContain('prices (EUR per tool_call)')
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

describe('formatRows for tiered prices', () => {
  const servers = (usd: string) => [
    {
      amount_type: 'unit_based',
      price_currency: 'usd',
      tiers: {
        type: 'volume',
        tiers: [
          { bound: 10, unit_amount: usd },
          { bound: null, unit_amount: '800' },
        ],
      },
      minimum_units: 2,
    },
    fixed('eur', 900),
  ]

  test('marks only the tiers that changed, in the currency that changed', () => {
    const output = stripAnsi(
      formatRows(
        '',
        [{ field: 'prices', before: servers('1000'), after: servers('1100') }],
        'updated',
      ).join('\n'),
    )
    expect(output).toBe(
      [
        'prices (USD per unit)',
        '    volume, minimum 2',
        '  - 1–10  $10',
        '  + 1–10  $11',
        '    11+   $8',
      ].join('\n'),
    )
  })
})

describe('lineDiff', () => {
  const text = (before: string[], after: string[]) =>
    lineDiff(before, after).map(({ mark, line }) => `${mark} ${line}`)

  test('keeps the lines shared at the start and end as context', () => {
    expect(text(['a', 'b', 'c'], ['a', 'x', 'b', 'c'])).toEqual([
      '  a',
      '+ x',
      '  b',
      '  c',
    ])
    expect(text(['a', 'b'], ['a'])).toEqual(['  a', '- b'])
    expect(text(['a'], ['b'])).toEqual(['- a', '+ b'])
  })
})

describe('formatRows with wide values', () => {
  test('stacks a change that would not fit on one row', () => {
    const before =
      '4c12c56eb4452fe6ff96fc1f1c5d6865863b2ccdb79a71f33b82b4f48e85d957'
    const after =
      'bb3fc5e5582aebd4d08beccdef425659478ac62cfb44f39cf6ab9dfe6834529c'
    const output = stripAnsi(
      formatRows(
        '      ',
        [{ field: 'checksum', before, after }],
        'updated',
      ).join('\n'),
    )
    expect(output).toBe(
      ['      checksum', `        - "${before}"`, `        + "${after}"`].join(
        '\n',
      ),
    )
  })
})

describe('formatRows for catalog versions', () => {
  test('omits the catalog version hashes', () => {
    expect(
      formatRows(
        '',
        [{ field: 'catalog', before: 'a'.repeat(64), after: 'b'.repeat(64) }],
        'updated',
      ),
    ).toEqual([])
  })
})

describe('tally and planSummary', () => {
  const entries = [
    { section: 'meters', id: 'a', action: 'created' as const, diff: [] },
    { section: 'meters', id: 'b', action: 'created' as const, diff: [] },
    { section: 'meters', id: 'c', action: 'updated' as const, diff: [] },
    { section: 'meters', id: 'd', action: 'unchanged' as const, diff: [] },
  ]

  test('counts entries per action', () => {
    expect(stripAnsi(tally(entries))).toBe('2 created, 1 updated, 1 unchanged')
  })

  test('summarises a plan with additions in green and changes in yellow', () => {
    const summary = planSummary(entries)
    expect(stripAnsi(summary)).toBe(
      '  Plan: 1 to change, 2 to add, 1 unchanged',
    )
    expect(summary).toContain(ui.yellow('1 to change'))
    expect(summary).toContain(ui.green('2 to add'))
  })
})

describe('formatRows for settings', () => {
  const diff = [{ field: 'currency', before: 'usd', after: 'eur' }]

  test('renders setting values as plain codes only in the settings section', () => {
    expect(
      stripAnsi(formatRows('', diff, 'updated', 'settings').join('\n')),
    ).toBe('currency  USD → EUR')
    expect(
      stripAnsi(formatRows('', diff, 'updated', 'products').join('\n')),
    ).toBe('currency  "usd" → "eur"')
  })
})
