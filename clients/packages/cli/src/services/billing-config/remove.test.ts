import { describe, expect, test } from 'vitest'
import {
  removeFromJson,
  removeFromScript,
} from '@/services/billing-config/remove'

const script = [
  "import { defineConfig, usd } from '@polar-sh/polar'",
  '',
  'export default defineConfig({',
  '  meters: ({ meter }) => ({',
  '    // Replaced by pears',
  "    apples: meter('Apples').deprecated().where({ name: '}' }).count(),",
  "    'pears': meter(`Pears ${'}'}`).count(),",
  '  }),',
  '  benefits: ({ flag }) => ({',
  "    beta: flag('Beta').deprecated(),",
  "    support: flag('Support')",
  '  }),',
  '  products: ({ product, meter }) => ({',
  '    legacy: product()',
  "      .prices(meter('apples').flat().amount(usd(0.01)))",
  "      .recurring('monthly')",
  "      .grants(['beta'])",
  '      .deprecated(),',
  "    pro: product().prices(meter('pears').flat().amount(usd(0.01))).recurring('monthly'),",
  '  }),',
  '})',
  '',
].join('\n')

describe('removeFromScript', () => {
  test('removes whole entries and leaves the rest untouched', () => {
    const { source, missing } = removeFromScript(script, [
      { section: 'meters', id: 'apples' },
      { section: 'benefits', id: 'beta' },
      { section: 'products', id: 'legacy' },
    ])
    expect(missing).toEqual([])
    expect(source).toBe(
      [
        "import { defineConfig, usd } from '@polar-sh/polar'",
        '',
        'export default defineConfig({',
        '  meters: ({ meter }) => ({',
        '    // Replaced by pears',
        "    'pears': meter(`Pears ${'}'}`).count(),",
        '  }),',
        '  benefits: ({ flag }) => ({',
        "    support: flag('Support')",
        '  }),',
        '  products: ({ product, meter }) => ({',
        "    pro: product().prices(meter('pears').flat().amount(usd(0.01))).recurring('monthly'),",
        '  }),',
        '})',
        '',
      ].join('\n'),
    )
  })

  test('removes the last entry without a trailing comma', () => {
    const { source } = removeFromScript(script, [
      { section: 'benefits', id: 'support' },
    ])
    expect(source).toContain(
      "  benefits: ({ flag }) => ({\n    beta: flag('Beta').deprecated(),\n  }),",
    )
  })

  test('removes entries sharing a line', () => {
    const { source } = removeFromScript(
      'defineConfig({ meters: ({ meter }) => ({ a: meter().count(), b: meter().count() }) })',
      [{ section: 'meters', id: 'a' }],
    )
    expect(source).toBe(
      'defineConfig({ meters: ({ meter }) => ({ b: meter().count() }) })',
    )
  })

  test('ignores quotes and brackets in comments', () => {
    const { source } = removeFromScript(
      [
        'defineConfig({ meters: ({ meter }) => ({',
        "  // don't close }",
        '  a: meter().count(), /* ) */',
        '  b: meter().count(),',
        '}) })',
      ].join('\n'),
      [{ section: 'meters', id: 'b' }],
    )
    expect(source).toBe(
      [
        'defineConfig({ meters: ({ meter }) => ({',
        "  // don't close }",
        '  a: meter().count(), /* ) */',
        '}) })',
      ].join('\n'),
    )
  })

  test('removes tuple entries', () => {
    const { source, missing } = removeFromScript(
      [
        'defineConfig({',
        '  meters: ({ meter }) => ([',
        "    ['2', meter('Two').count()],",
        "    ['1', meter('One').deprecated().count()],",
        '  ]),',
        '})',
      ].join('\n'),
      [{ section: 'meters', id: '1' }],
    )
    expect(missing).toEqual([])
    expect(source).toBe(
      [
        'defineConfig({',
        '  meters: ({ meter }) => ([',
        "    ['2', meter('Two').count()],",
        '  ]),',
        '})',
      ].join('\n'),
    )
  })

  test('removes entries a block-bodied section returns', () => {
    const { source, missing } = removeFromScript(
      [
        'defineConfig({',
        '  meters: ({ meter }) => {',
        "    const base = () => { return { a: meter('A') } }",
        '    return {',
        '      apples: base().count(),',
        '      pears: base().count(),',
        '    }',
        '  },',
        '})',
      ].join('\n'),
      [{ section: 'meters', id: 'apples' }],
    )
    expect(missing).toEqual([])
    expect(source).toBe(
      [
        'defineConfig({',
        '  meters: ({ meter }) => {',
        "    const base = () => { return { a: meter('A') } }",
        '    return {',
        '      pears: base().count(),',
        '    }',
        '  },',
        '})',
      ].join('\n'),
    )
  })

  test('matches quoted keys with escapes', () => {
    const { source, missing } = removeFromScript(
      [
        'defineConfig({ meters: ({ meter }) => ({',
        '  "say \\"hi\\"": meter().count(),',
        '  "a\\u0062c": meter().count(),',
        '  b: meter().count(),',
        '}) })',
      ].join('\n'),
      [
        { section: 'meters', id: 'say "hi"' },
        { section: 'meters', id: 'abc' },
      ],
    )
    expect(missing).toEqual([])
    expect(source).toBe(
      [
        'defineConfig({ meters: ({ meter }) => ({',
        '  b: meter().count(),',
        '}) })',
      ].join('\n'),
    )
  })

  test('changes nothing when an entry cannot be found', () => {
    const removals = [
      { section: 'meters', id: 'apples' },
      { section: 'meters', id: 'name' },
    ]
    expect(removeFromScript(script, removals)).toEqual({
      source: script,
      missing: [{ section: 'meters', id: 'name' }],
    })
  })
})

describe('removeFromJson', () => {
  const input = {
    meters: [{ external_id: 'apples' }, { external_id: 'pears' }],
    benefits: [{ external_id: 'beta' }],
  }
  const json = `${JSON.stringify(input, null, 2)}\n`

  test('removes entries by external ID', () => {
    const { source, missing } = removeFromJson(json, input, [
      { section: 'meters', id: 'apples' },
      { section: 'benefits', id: 'beta' },
    ])
    expect(missing).toEqual([])
    expect(JSON.parse(source)).toEqual({
      meters: [{ external_id: 'pears' }],
      benefits: [],
    })
  })

  test('changes nothing when an entry cannot be found', () => {
    expect(
      removeFromJson(json, input, [{ section: 'products', id: 'legacy' }]),
    ).toEqual({
      source: json,
      missing: [{ section: 'products', id: 'legacy' }],
    })
  })
})
