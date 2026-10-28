import { describe, expect, test } from 'vitest'
import type { LoadedConfig } from '@/schemas/BillingConfig'
import { planMarkdown } from '@/utils/billing-config/markdown'

const source = '{\n  "meters": []\n}'

const config: LoadedConfig = {
  file: 'polar.json',
  source,
  input: JSON.parse(source),
  generated: false,
  issues: [],
}

const acme = {
  id: 'org-1',
  name: 'Acme_Inc',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const fixed = (price_amount: number) => ({
  amount_type: 'fixed',
  price_currency: 'usd',
  price_amount,
})

const entries = [
  {
    section: 'meters',
    id: 'tool_call',
    action: 'updated' as const,
    diff: [{ field: 'name', before: 'Tool calls', after: 'Tool calls V2' }],
  },
  {
    section: 'benefits',
    id: 'spare',
    action: 'unchanged' as const,
    diff: [],
  },
  {
    section: 'products',
    id: 'team',
    action: 'created' as const,
    diff: [
      { field: 'name', before: null, after: 'Team' },
      { field: 'recurring_interval', before: null, after: 'month' },
      { field: 'recurring_interval_count', before: null, after: 1 },
      { field: 'prices', before: null, after: [fixed(4900)] },
      { field: 'description', before: null, after: null },
    ],
  },
  {
    section: 'products',
    id: 'pro',
    action: 'updated' as const,
    diff: [
      { field: 'visibility', before: null, after: 'public' },
      { field: 'prices', before: [fixed(1900)], after: [fixed(2900)] },
    ],
  },
]

describe('planMarkdown', () => {
  test('titles, notes the target and diffs each changed section', () => {
    expect(planMarkdown(config, acme, { entries, issues: [] })).toBe(
      [
        '## Polar billing plan updated',
        '',
        '> [!NOTE]',
        "> Applying the config in this pull request changes billing for **Acme\\_Inc** in sandbox. Review every change below before it's applied.",
        '',
        '| Organization | Environment | Config | Changes |',
        '| --- | --- | --- | --- |',
        '| Acme\\_Inc | sandbox | `polar.json` | 2 to change, 1 to add, 1 unchanged |',
        '',
        '#### Meters',
        '',
        '```diff',
        '  tool_call',
        '-   name  "Tool calls"',
        '+   name  "Tool calls V2"',
        '```',
        '',
        '#### Products',
        '',
        '```diff',
        '+ team',
        '+   name          "Team"',
        '+   recurrence    per month',
        '+   prices (USD)  $49',
        '  pro',
        '+   visibility    "public"',
        '-   prices (USD)  $19',
        '+   prices (USD)  $29',
        '```',
      ].join('\n'),
    )
  })

  test('has nothing to say when the plan changes nothing and has no errors', () => {
    expect(
      planMarkdown(config, acme, {
        entries: [entries[1]!],
        issues: [
          {
            severity: 'warning',
            code: 'unknown_event',
            path: 'meters',
            message: 'No events yet',
            location: { line: 2, column: 3, length: 8 },
          },
        ],
      }),
    ).toBeUndefined()
  })

  test('cautions and ends with the problems when the config has errors', () => {
    const output = planMarkdown(config, acme, {
      entries: [],
      issues: [
        {
          severity: 'error',
          code: 'meter_locked',
          path: 'meters',
          message: 'Locked',
          location: { line: 2, column: 3, length: 8 },
        },
      ],
    })
    expect(output).toContain("> [!CAUTION]\n> `polar.json` can't be applied")
    expect(output).toMatch(/#### Problems\n\n```\n.*Error:.*\n```$/s)
  })

  test('fences a block with more backticks than it contains', () => {
    const output = planMarkdown(config, acme, {
      entries: [
        {
          section: 'meters',
          id: 'tool_call',
          action: 'updated',
          diff: [{ field: 'name', before: 'a', after: '```' }],
        },
      ],
      issues: [],
    })
    expect(output).toContain('````diff\n')
    expect(output).toContain('\n````')
  })

  test('gives a section it does not know a heading of its own', () => {
    const output = planMarkdown(config, acme, {
      entries: [
        {
          section: 'checkout_links',
          id: 'promo',
          action: 'created',
          diff: [{ field: 'label', before: null, after: 'Promo' }],
        },
      ],
      issues: [],
    })
    expect(output).toContain(
      [
        '#### Checkout links',
        '',
        '```diff',
        '+ promo',
        '+   label  "Promo"',
        '```',
      ].join('\n'),
    )
  })

  test('diffs a multi-line value line by line', () => {
    const tiered = (amount: string) => [
      {
        amount_type: 'seat_based',
        price_currency: 'usd',
        tiers: {
          type: 'graduated',
          tiers: [
            { bound: 5, unit_amount: amount },
            { bound: null, unit_amount: '1500' },
          ],
        },
        minimum_units: 1,
      },
    ]
    const output = planMarkdown(config, acme, {
      entries: [
        {
          section: 'products',
          id: 'team',
          action: 'updated',
          diff: [
            { field: 'prices', before: tiered('2000'), after: tiered('2500') },
          ],
        },
      ],
      issues: [],
    })
    expect(output).toContain(
      [
        '  team',
        '    prices (USD per seat)',
        '      graduated',
        '-     1–5  $20',
        '+     1–5  $25',
        '      6+   $15',
      ].join('\n'),
    )
  })

  test('diffs settings groups like entries', () => {
    const markdown = planMarkdown(config, acme, {
      entries: [
        {
          section: 'settings',
          id: 'payments',
          action: 'updated',
          diff: [{ field: 'currency', before: 'usd', after: 'eur' }],
        },
      ],
      issues: [],
    })
    expect(markdown).toContain(
      '#### Settings\n\n```diff\n  payments\n-   currency  USD\n+   currency  EUR\n```',
    )
  })

  test('redacts webhook urls by the format on their own side', () => {
    const slack = 'https://hooks.slack.com/services/T0/B0/token'
    const after = 'https://app:pw@app.test/hook?token=new'
    const input = {
      webhooks: [
        { external_id: 'app', url: after, format: 'raw', events: [] },
        { external_id: 'sales', url: slack, format: 'slack', events: [] },
      ],
    }
    const markdown = planMarkdown({ ...config, input }, acme, {
      entries: [
        {
          section: 'webhooks',
          id: 'app',
          action: 'updated',
          diff: [
            { field: 'url', before: slack, after },
            { field: 'format', before: 'slack', after: 'raw' },
          ],
        },
        {
          section: 'webhooks',
          id: 'sales',
          action: 'created',
          diff: [{ field: 'url', before: null, after: slack }],
        },
      ],
      issues: [],
    })
    expect(markdown).not.toContain('B0/token')
    expect(markdown).not.toContain('token=new')
    expect(markdown).not.toContain('pw@')
    expect(markdown).toContain('-   url     https://hooks.slack.com/***')
    expect(markdown).toContain(
      '+   url     https://***@app.test/hook?token=***',
    )
    expect(markdown).toContain('+   url  https://hooks.slack.com/***')
  })
})
