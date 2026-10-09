import { describe, expect, test } from 'vitest'
import { locateInScript } from '@/services/billing-config/script-locations'

const builder = [
  "import { defineConfig, eq } from '@polar-sh/polar'",
  '',
  'export default defineConfig({',
  '  meters: ({ meter }) => ({',
  "    tool_calls: meter({ displayName: 'Tool Calls' })",
  "      .where(eq('name', 'tool_call'))",
  '      .count(),',
  "    'tokens': meter({ displayName: 'Tokens' })",
  "      .where(eq('name', 'tool_call'))",
  "      .sum('tokens'),",
  '  }),',
  '})',
  '',
].join('\n')

const input = {
  meters: [{ external_id: 'tool_calls' }, { external_id: 'tokens' }],
}

describe('locateInScript', () => {
  test('points at the offending value inside the right entry', () => {
    expect(
      locateInScript(
        builder,
        input,
        ['meters', 1, 'filter', 'clauses', 0, 'value'],
        'tool_call',
      ),
    ).toEqual({ line: 9, column: 25, length: 11 })
  })

  test('points at the builder call for a field without a value', () => {
    expect(
      locateInScript(builder, input, ['meters', 0, 'filter'], undefined),
    ).toEqual({ line: 6, column: 7, length: 7 })
    expect(
      locateInScript(builder, input, ['meters', 1, 'aggregation'], undefined),
    ).toEqual({ line: 10, column: 7, length: 5 })
  })

  test('points at a plain object field by its key', () => {
    const plain = [
      'export default {',
      '  meters: [',
      "    { external_id: 'a', name: 1, unit: 'custom' },",
      '  ],',
      '}',
    ].join('\n')
    expect(
      locateInScript(
        plain,
        { meters: [{ external_id: 'a' }] },
        ['meters', 0, 'name'],
        1,
      ),
    ).toEqual({ line: 3, column: 31, length: 1 })
  })

  test('prefers the value after the field over an equal value earlier in the entry', () => {
    const same = [
      'export default defineConfig({',
      '  meters: ({ meter }) => ({',
      "    tool_call: meter('tool_call')",
      "      .where(eq('name', 'tool_call'))",
      '      .count(),',
      '  }),',
      '})',
    ].join('\n')
    expect(
      locateInScript(
        same,
        { meters: [{ external_id: 'tool_call' }] },
        ['meters', 0, 'filter', 'clauses', 0, 'value'],
        'tool_call',
      ),
    ).toEqual({ line: 4, column: 25, length: 11 })
  })

  test('tells repeated external ids apart by their position', () => {
    const repeated = [
      'export default defineConfig({',
      '  meters: ({ meter }) => ([',
      "    ['calls', meter('A').count()],",
      "    ['calls', meter('B').count()],",
      '  ]),',
      '})',
    ].join('\n')
    const input = {
      meters: [{ external_id: 'calls' }, { external_id: 'calls' }],
    }
    expect(
      locateInScript(repeated, input, ['meters', 1, 'external_id'], 'calls'),
    ).toEqual({ line: 4, column: 6, length: 7 })
    expect(locateInScript(repeated, input, ['meters', 0, 'name'], 'A')).toEqual(
      { line: 3, column: 21, length: 3 },
    )
  })

  test('falls back to the entry key, then to nothing', () => {
    expect(
      locateInScript(builder, input, ['meters', 0, 'mystery'], undefined),
    ).toEqual({ line: 5, column: 5, length: 10 })
    expect(
      locateInScript(
        builder,
        { meters: [{ external_id: 'missing' }] },
        ['meters', 0, 'name'],
        undefined,
      ),
    ).toBeUndefined()
    expect(
      locateInScript(builder, input, ['meters'], undefined),
    ).toBeUndefined()
  })
})

describe('locateInScript with an events section', () => {
  const config = [
    "import { defineConfig } from '@polar-sh/polar'",
    '',
    'export default defineConfig({',
    '  events: {',
    '    tool_call: z.object({ tool: z.string() }),',
    '  },',
    '  meters: ({ meter, events }) => ({',
    "    tool_call: meter('Tool calls').on(events.tool_call).count(),",
    '  }),',
    '  benefits: ({ credits }) => ({',
    "    tool_calls: credits('Included').meter('tool_call').units(1000),",
    '  }),',
    '  products: ({ product, free }) => ({',
    "    free: product('Free').prices(free()).recurring('monthly').grants(['tool_calls']),",
    '  }),',
    '})',
    '',
  ].join('\n')
  const input = {
    meters: [{ external_id: 'tool_call' }],
    benefits: [{ external_id: 'tool_calls' }],
    products: [{ external_id: 'free', benefits: ['tool_calls'] }],
  }

  test('anchors a meter inside the meters section, not on its event', () => {
    expect(
      locateInScript(
        config,
        input,
        ['meters', 0, 'filter', 'clauses', 0, 'value'],
        'tool_call',
      ),
    ).toEqual({ line: 8, column: 35, length: 4 })
  })

  test('keeps a product inside the products section', () => {
    expect(
      locateInScript(
        config,
        input,
        ['products', 0, 'benefits', 0],
        'tool_calls',
      ),
    ).toEqual({ line: 14, column: 71, length: 12 })
  })
})
