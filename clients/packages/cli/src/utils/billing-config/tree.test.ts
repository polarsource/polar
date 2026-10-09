import { describe, expect, test } from 'vitest'
import type { AppliedEntry } from '@/schemas/BillingConfig'
import { formatTree } from '@/utils/billing-config/tree'
import { stripAnsi } from '@/utils/test-utils/cli'

const credits = (external_id: string, units: number, rollover = false) => ({
  external_id,
  description: `${units} tool calls`,
  type: 'meter_credit',
  properties: { meter: 'tool_call', units, rollover },
})

const input = {
  meters: [
    {
      external_id: 'tool_call',
      name: 'Tool calls',
      filter: {
        conjunction: 'and',
        clauses: [{ property: 'name', operator: 'eq', value: 'tool_call' }],
      },
      aggregation: { func: 'count' },
      unit: 'custom',
      custom_label: 'tool calls',
    },
  ],
  benefits: [
    {
      external_id: 'custom_servers',
      description: 'Custom servers',
      type: 'feature_flag',
    },
    credits('tool_calls', 1000),
    credits('free_tool_calls', 5),
    credits('topup_100', 100, true),
    credits('spare', 7),
  ],
  products: [
    {
      external_id: 'free',
      name: 'Free',
      recurring_interval: 'month',
      recurring_interval_count: 1,
      prices: [
        { amount_type: 'fixed', price_currency: 'usd', price_amount: 0 },
      ],
      benefits: ['free_tool_calls'],
    },
    {
      external_id: 'pro',
      name: 'Pro',
      recurring_interval: 'month',
      recurring_interval_count: 1,
      prices: [
        { amount_type: 'fixed', price_currency: 'usd', price_amount: 9999 },
        { amount_type: 'fixed', price_currency: 'eur', price_amount: 9999 },
        {
          amount_type: 'metered_unit',
          price_currency: 'usd',
          meter: 'tool_call',
          unit_amount: '0.1',
          cap_amount: 10000,
        },
        {
          amount_type: 'metered_unit',
          price_currency: 'eur',
          meter: 'tool_call',
          unit_amount: '0.09',
          cap_amount: 9000,
        },
      ],
      benefits: ['custom_servers', 'tool_calls'],
    },
    {
      external_id: 'topup_100',
      name: '100 tool calls',
      description: 'Never run out',
      visibility: 'hidden',
      recurring_interval: null,
      recurring_interval_count: null,
      prices: [
        { amount_type: 'fixed', price_currency: 'usd', price_amount: 900 },
      ],
      benefits: ['topup_100'],
    },
    {
      external_id: 'team',
      name: 'Team',
      recurring_interval: 'year',
      recurring_interval_count: 1,
      prices: [
        { amount_type: 'fixed', price_currency: 'usd', price_amount: 99900 },
      ],
      benefits: ['tool_calls'],
    },
  ],
}

const entry = (
  section: string,
  id: string,
  action: AppliedEntry['action'],
  diff: AppliedEntry['diff'] = [],
): AppliedEntry => ({ section, id, action, diff })

describe('formatTree', () => {
  test('describes each resource and nests benefits under the products granting them', () => {
    const output = stripAnsi(
      formatTree(input, [
        entry('meters', 'tool_call', 'updated', [
          { field: 'name', before: 'tool_call', after: 'Tool calls' },
        ]),
        entry('benefits', 'custom_servers', 'unchanged'),
        entry('benefits', 'tool_calls', 'unchanged'),
        entry('benefits', 'free_tool_calls', 'created'),
        entry('benefits', 'topup_100', 'created'),
        entry('benefits', 'spare', 'created'),
        entry('products', 'free', 'created', [
          { field: 'name', before: null, after: 'Free' },
          { field: 'visibility', before: null, after: 'public' },
          { field: 'benefits', before: null, after: ['free_tool_calls'] },
        ]),
        entry('products', 'pro', 'updated', [
          {
            field: 'benefits',
            before: ['custom_servers', 'a02f7cd7'],
            after: ['custom_servers', 'tool_calls'],
          },
        ]),
        entry('products', 'topup_100', 'created', [
          { field: 'description', before: null, after: 'Never run out' },
          { field: 'benefits', before: null, after: ['topup_100'] },
        ]),
        entry('products', 'team', 'updated', [
          { field: 'name', before: 'Team', after: 'Teams' },
        ]),
      ]),
    )
    expect(output).toBe(
      [
        '  meters',
        '  ~ tool_call',
        '      name  "tool_call" → "Tool calls"',
        '',
        '  benefits',
        '  + free_tool_calls',
        '      meter    tool_call',
        '      credits  5',
        '  + topup_100',
        '      meter     tool_call',
        '      credits   100',
        '      rollover  yes',
        '  + spare',
        '      meter    tool_call',
        '      credits  7',
        '  = custom_servers  unchanged',
        '  = tool_calls      unchanged',
        '',
        '  products',
        '  + free',
        '      $0 per month',
        '      └ + benefit free_tool_calls',
        '  ~ pro',
        '      ├ = benefit custom_servers',
        '      ├ + benefit tool_calls',
        '      └ - benefit a02f7cd7',
        '  + topup_100',
        '      $9 once',
        '      hidden',
        '      description  "Never run out"',
        '      └ + benefit topup_100',
        '  ~ team',
        '      name  "Team" → "Teams"',
      ].join('\n'),
    )
  })

  test('describes an updated benefit once, in its own section', () => {
    const output = stripAnsi(
      formatTree(input, [
        entry('benefits', 'tool_calls', 'updated', [
          {
            field: 'properties',
            before: { meter: 'tool_call', units: 500, rollover: false },
            after: { meter: 'tool_call', units: 1000, rollover: false },
          },
        ]),
        entry('products', 'pro', 'unchanged'),
        entry('products', 'team', 'unchanged'),
      ]),
    )
    expect(output).toBe(
      [
        '  benefits',
        '  ~ tool_calls',
        '      properties  500 tool_call credits → 1,000 tool_call credits',
        '',
        '  products',
        '  = pro   unchanged',
        '  = team  unchanged',
      ].join('\n'),
    )
  })

  test('lists the meters a created product charges for as nodes', () => {
    const metered = (price_currency: string, unit_amount: string) => ({
      amount_type: 'metered_unit',
      price_currency,
      meter: 'tool_call',
      unit_amount,
      cap_amount: price_currency === 'usd' ? 10000 : null,
    })
    const output = stripAnsi(
      formatTree(
        {
          ...input,
          products: [
            {
              external_id: 'usage',
              name: 'Usage',
              recurring_interval: 'month',
              recurring_interval_count: 1,
              prices: [metered('usd', '0.1'), metered('eur', '0.09')],
              benefits: [],
            },
          ],
        },
        [entry('products', 'usage', 'created')],
      ),
    )
    expect(output).toBe(
      [
        '  products',
        '  + usage',
        '      billed per month',
        '      └ + meter tool_call',
        '            $1 / €0.90 per 1,000 tool calls',
        '            capped at $100',
      ].join('\n'),
    )
  })

  test('grants every configured benefit anew when a created product has no benefits diff', () => {
    const output = stripAnsi(
      formatTree(input, [
        entry('products', 'free', 'created', [
          { field: 'name', before: null, after: 'Free' },
        ]),
      ]),
    )
    expect(output).toBe(
      [
        '  products',
        '  + free',
        '      $0 per month',
        '      └ + benefit free_tool_calls',
      ].join('\n'),
    )
  })

  test('falls back to ids when the config has no matching entry', () => {
    const output = stripAnsi(
      formatTree(undefined, [
        entry('meters', 'to\u0007kens', 'created', [
          { field: 'name', before: null, after: 'Tokens' },
        ]),
      ]),
    )
    expect(output).toBe(['  meters', '  + tokens'].join('\n'))
  })
})
