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

  test('shows a created benefit as private only when it is', () => {
    const output = stripAnsi(
      formatTree(
        {
          ...input,
          benefits: [
            {
              external_id: 'beta',
              description: 'Beta',
              type: 'feature_flag',
              visibility: 'private',
            },
            { ...credits('tool_calls', 1000), visibility: 'public' },
          ],
        },
        [
          entry('benefits', 'beta', 'created', [
            { field: 'visibility', before: null, after: 'private' },
          ]),
          entry('benefits', 'tool_calls', 'created', [
            { field: 'visibility', before: null, after: 'public' },
          ]),
        ],
      ),
    )
    expect(output).toBe(
      [
        '  benefits',
        '  + beta',
        '      type        feature flag',
        '      visibility  private',
        '  + tool_calls',
        '      meter    tool_call',
        '      credits  1,000',
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

  test('shows the tiers of a created seat- or unit-based product', () => {
    const output = stripAnsi(
      formatTree(
        {
          ...input,
          products: [
            {
              external_id: 'seats',
              name: 'Seats',
              recurring_interval: 'month',
              recurring_interval_count: 1,
              prices: [
                {
                  amount_type: 'seat_based',
                  price_currency: 'usd',
                  tax_behavior: 'exclusive',
                  minimum_units: 2,
                  tiers: {
                    type: 'graduated',
                    tiers: [
                      { bound: 10, unit_amount: 1000 },
                      { bound: null, unit_amount: 800 },
                    ],
                  },
                },
              ],
              benefits: [],
            },
            {
              external_id: 'credits',
              name: 'Credits',
              recurring_interval: null,
              recurring_interval_count: null,
              prices: [
                {
                  amount_type: 'unit_based',
                  price_currency: 'eur',
                  unit_label: { en: { one: 'credit', other: 'credits' } },
                  tiers: {
                    type: 'volume',
                    tiers: [{ bound: null, unit_amount: 50 }],
                  },
                },
              ],
              benefits: [],
            },
          ],
        },
        [
          entry('products', 'seats', 'created', [
            { field: 'prices', before: null, after: [] },
          ]),
          entry('products', 'credits', 'created'),
        ],
      ),
    )
    expect(output).toBe(
      [
        '  products',
        '  + seats',
        '      billed per month, tax exclusive',
        '      USD per seat, graduated, minimum 2',
        '        1–10  $10',
        '        11+   $8',
        '  + credits',
        '      billed once',
        '      EUR per credit, volume',
        '        1+  €0.50',
      ].join('\n'),
    )
  })

  test('lists the tiers of a created product metered in tiers under its meter', () => {
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
              prices: [
                {
                  amount_type: 'metered_tiers',
                  price_currency: 'usd',
                  meter: 'tool_call',
                  cap_amount: 10000,
                  tiers: {
                    type: 'graduated',
                    tiers: [
                      { bound: 1000, unit_amount: 0 },
                      { bound: null, unit_amount: '0.5' },
                    ],
                  },
                },
              ],
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
        '            USD per tool calls, graduated',
        '              up to 1,000  $0 per 1,000',
        '              over 1,000   $5 per 1,000',
        '              capped at $100',
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

  test('shows only the host of a created Slack webhook', () => {
    const slackUrl = 'https://hooks.slack.com/services/T0/B0/token'
    const output = stripAnsi(
      formatTree(
        {
          webhooks: [
            {
              external_id: 'sales',
              url: slackUrl,
              format: 'slack',
              events: ['order.paid', 'subscription.canceled'],
              api_version: '2027-01',
            },
          ],
        },
        [
          entry('webhooks', 'sales', 'created', [
            { field: 'url', before: null, after: slackUrl },
            { field: 'format', before: null, after: 'slack' },
          ]),
        ],
      ),
    )
    expect(output).toBe(
      [
        '  webhooks',
        '  + sales',
        '      url     https://hooks.slack.com/***',
        '      format  slack',
        '      events  order.paid, subscription.canceled',
      ].join('\n'),
    )
  })

  test('redacts both sides of an updated webhook url by their own format', () => {
    const stdout: { columns?: number | undefined } = process.stdout
    const columns = stdout.columns
    stdout.columns = 80
    try {
      const after = 'https://app:pw@app.test/hook?token=new'
      const output = stripAnsi(
        formatTree(
          {
            webhooks: [
              {
                external_id: 'app',
                url: after,
                format: 'raw',
                events: ['order.paid'],
                api_version: '2027-01',
              },
            ],
          },
          [
            entry('webhooks', 'app', 'updated', [
              {
                field: 'url',
                before: 'https://hooks.slack.com/services/T0/B0/token',
                after,
              },
              { field: 'format', before: 'slack', after: 'raw' },
            ]),
          ],
        ),
      )
      expect(output).toBe(
        [
          '  webhooks',
          '  ~ app',
          '      url',
          '        - https://hooks.slack.com/***',
          '        + https://***@app.test/hook?token=***',
          '      format  "slack" → "raw"',
        ].join('\n'),
      )
    } finally {
      stdout.columns = columns
    }
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

  test('lists a section it has no sentences for, with every field', () => {
    const output = stripAnsi(
      formatTree({}, [
        entry('checkout_links', 'promo', 'created', [
          { field: 'label', before: null, after: 'Promo' },
        ]),
      ]),
    )
    expect(output).toBe(
      ['  checkout_links', '  + promo', '      label  "Promo"'].join('\n'),
    )
  })

  test('renders settings groups like entries, first', () => {
    const output = stripAnsi(
      formatTree({ settings: { payments: { currency: 'eur' } } }, [
        {
          section: 'meters',
          id: 'tool_call',
          action: 'unchanged',
          diff: [],
        },
        {
          section: 'settings',
          id: 'payments',
          action: 'updated',
          diff: [
            { field: 'currency', before: 'usd', after: 'eur' },
            { field: 'tax', before: 'location', after: 'inclusive' },
          ],
        },
      ]),
    )
    expect(
      output
        .split('\n')
        .slice(0, 4)
        .map((line) => line.trimEnd()),
    ).toEqual([
      '  settings',
      '  ~ payments',
      '      currency  USD → EUR',
      '      tax       location → inclusive',
    ])
  })

  test("mentions the tax behavior of a created product's fixed prices", () => {
    const output = stripAnsi(
      formatTree(
        {
          products: [
            {
              external_id: 'addon',
              name: 'Add-on',
              recurring_interval: 'month',
              recurring_interval_count: 1,
              prices: [
                {
                  amount_type: 'fixed',
                  price_currency: 'usd',
                  tax_behavior: 'inclusive',
                  price_amount: 500,
                },
              ],
              benefits: [],
            },
          ],
        },
        [entry('products', 'addon', 'created')],
      ),
    )
    expect(output).toContain('$5 per month, tax inclusive')
  })

  test('pairs each amount with its tax behavior when they differ', () => {
    const output = stripAnsi(
      formatTree(
        {
          products: [
            {
              external_id: 'addon',
              name: 'Add-on',
              recurring_interval: 'month',
              recurring_interval_count: 1,
              prices: [
                {
                  amount_type: 'fixed',
                  price_currency: 'usd',
                  tax_behavior: 'inclusive',
                  price_amount: 1000,
                },
                {
                  amount_type: 'fixed',
                  price_currency: 'eur',
                  tax_behavior: 'exclusive',
                  price_amount: 900,
                },
                {
                  amount_type: 'metered_unit',
                  price_currency: 'usd',
                  tax_behavior: 'exclusive',
                  meter: 'tool_call',
                  unit_amount: '10',
                },
                {
                  amount_type: 'metered_unit',
                  price_currency: 'eur',
                  tax_behavior: 'exclusive',
                  meter: 'tool_call',
                  unit_amount: '9',
                },
              ],
              benefits: [],
            },
          ],
        },
        [entry('products', 'addon', 'created')],
      ),
    )
    expect(output).toContain(
      '$10 (tax inclusive) / €9 (tax exclusive) per month',
    )
    expect(output).toMatch(/\$0\.10 \/ €0\.09 per units\n\s+tax exclusive$/)
  })
})
