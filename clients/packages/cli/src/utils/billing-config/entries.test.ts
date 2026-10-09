import { describe, expect, test } from 'vitest'
import { formatEntries } from '@/utils/billing-config/entries'
import { stripAnsi } from '@/utils/test-utils/cli'

const ESC = String.fromCharCode(27)

describe('formatEntries', () => {
  test('groups entries under their section with a mark for what happened', () => {
    const output = stripAnsi(
      formatEntries([
        { section: 'meters', id: 'tool-calls', action: 'created', diff: [] },
        { section: 'meters', id: 'tokens', action: 'updated', diff: [] },
        {
          section: 'organization',
          id: 'organization',
          action: 'unchanged',
          diff: [],
        },
      ]),
    )
    expect(output).toBe(
      [
        '  meters',
        '    + tool-calls  created',
        '    ~ tokens      updated',
        '',
        '  organization',
        '    = organization  unchanged',
      ].join('\n'),
    )
  })

  test('lists each changed field under its entry', () => {
    const output = stripAnsi(
      formatEntries([
        {
          section: 'meters',
          id: 'tokens',
          action: 'updated',
          diff: [
            { field: 'name', before: 'Tokens', after: 'LLM tokens' },
            { field: 'custom_label', before: null, after: 'token' },
            {
              field: 'aggregation',
              before: { func: 'count' },
              after: { func: 'sum', property: 'n' },
            },
          ],
        },
        {
          section: 'meters',
          id: 'calls',
          action: 'created',
          diff: [
            { field: 'name', before: null, after: 'Calls' },
            {
              field: 'filter',
              before: null,
              after: {
                conjunction: 'and',
                clauses: [
                  { property: 'name', operator: 'eq', value: 'call' },
                  { property: 'status', operator: 'gte', value: 200 },
                ],
              },
            },
          ],
        },
        {
          section: 'meters',
          id: 'raw',
          action: 'updated',
          diff: [
            {
              field: 'metadata',
              before: { team: 'cli', owner: 'alice', region: 'eu-west-1' },
              after: { team: 'platform', owner: 'alice', region: 'eu-west-1' },
            },
          ],
        },
      ]),
    )
    expect(output).toBe(
      [
        '  meters',
        '    ~ tokens          updated',
        '        name          "Tokens" → "LLM tokens"',
        '        custom_label  unset → "token"',
        '        aggregation   count → sum(n)',
        '    + calls           created',
        '        name          "Calls"',
        '        filter        name = "call"',
        '                      AND status >= 200',
        '    ~ raw             updated',
        '        metadata',
        '          - {',
        '              "team": "cli",',
        '              "owner": "alice",',
        '              "region": "eu-west-1"',
        '            }',
        '          + {',
        '              "team": "platform",',
        '              "owner": "alice",',
        '              "region": "eu-west-1"',
        '            }',
      ].join('\n'),
    )
  })

  test('merges the recurrence and splits a price list into one row per kind', () => {
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
    const output = stripAnsi(
      formatEntries([
        {
          section: 'products',
          id: 'pro',
          action: 'created',
          diff: [
            { field: 'name', before: null, after: 'Pro' },
            { field: 'recurring_interval', before: null, after: 'month' },
            { field: 'recurring_interval_count', before: null, after: 1 },
            {
              field: 'prices',
              before: null,
              after: [
                fixed('usd', 9999),
                fixed('eur', 9999),
                metered('usd', '10'),
                metered('eur', '9'),
              ],
            },
          ],
        },
        {
          section: 'products',
          id: 'basic',
          action: 'updated',
          diff: [
            { field: 'recurring_interval', before: 'month', after: 'year' },
            { field: 'recurring_interval_count', before: 3, after: 1 },
            {
              field: 'prices',
              before: [fixed('usd', 999)],
              after: [fixed('usd', 1999), metered('usd', '10')],
            },
          ],
        },
      ]),
    )
    expect(output).toBe(
      [
        '  products',
        '    + pro                       created',
        '        name                    "Pro"',
        '        recurrence              every month',
        '        prices (fixed)          USD 99.99, EUR 99.99',
        '        prices (per tool_call)  USD 0.10, EUR 0.09',
        '                                capped at USD 100.00, EUR 100.00',
        '    ~ basic                     updated',
        '        recurrence              every 3 months → every year',
        '        prices (fixed)          USD 9.99 → USD 19.99',
        '        prices (per tool_call)',
        '          - unset',
        '          + USD 0.10',
        '            capped at USD 100.00',
      ].join('\n'),
    )
  })

  test('strips control characters from ids and field names', () => {
    const output = stripAnsi(
      formatEntries([
        {
          section: 'meters',
          id: `to${ESC}[31mol\ncalls`,
          action: 'created',
          diff: [{ field: 'na\u0007me', before: null, after: 'x' }],
        },
      ]),
    )
    expect(output).toContain('+ to[31mol calls  created')
    expect(output).toContain('name')
    expect(output).not.toContain('\u0007')
  })
})
