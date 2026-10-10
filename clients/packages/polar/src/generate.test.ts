import { Effect } from 'effect'
import { resolve } from 'node:path'
import ts from 'typescript'
import { expect, test } from 'vitest'
import { generateConfig } from './generate'
import * as api from './index'
import type { Config, MeterConfig, PolarConfig } from './index'

const meter: MeterConfig = {
  external_id: 'tokens',
  name: 'Tokens',
  filter: {
    conjunction: 'and',
    clauses: [
      { property: 'name', operator: 'eq', value: 'llm.completion' },
      { property: 'inputTokens', operator: 'gte', value: 1000 },
    ],
  },
  aggregation: { func: 'sum', property: 'inputTokens' },
  unit: 'scalar',
}

const clauses = [
  { property: '__proto__', operator: 'eq', value: 'Hellooo aladåb' },
  { property: 'enabled', operator: 'ne', value: false },
  { property: '10', operator: 'gt', value: -2147483648 },
  { property: '2', operator: 'gte', value: 2147483647 },
  { property: 'tokens', operator: 'lt', value: -0 },
  { property: 'tokens', operator: 'lte', value: 10 },
  { property: 'name', operator: 'like', value: '"\\\n` ${notCode}' },
  { property: '', operator: 'not_like', value: '' },
] satisfies MeterConfig['filter']['clauses']

const cases: [string, PolarConfig][] = [
  ['tokens example', { meters: [meter] }],
  ['empty config', { meters: [] }],
  [
    'empty and filter',
    { meters: [{ ...meter, filter: { conjunction: 'and', clauses: [] } }] },
  ],
  [
    'empty or filter',
    { meters: [{ ...meter, filter: { conjunction: 'or', clauses: [] } }] },
  ],
  [
    'all operators and repeated properties',
    { meters: [{ ...meter, filter: { conjunction: 'and', clauses } }] },
  ],
  [
    'or filter without event restriction',
    { meters: [{ ...meter, filter: { conjunction: 'or', clauses } }] },
  ],
  [
    'or filter with event restriction',
    { meters: [{ ...meter, filter: { ...meter.filter, conjunction: 'or' } }] },
  ],
  [
    'nested filter groups',
    {
      meters: [
        {
          ...meter,
          filter: {
            conjunction: 'and',
            clauses: [
              { property: 'name', operator: 'eq', value: 'llm.completion' },
              {
                conjunction: 'or',
                clauses: [
                  { property: 'model', operator: 'eq', value: 'gpt' },
                  { conjunction: 'and', clauses },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
  [
    'all aggregations and custom unit',
    {
      meters: [
        { ...meter, aggregation: { func: 'count' }, unit: 'token' },
        ...(['sum', 'min', 'max', 'avg', 'unique'] as const).map((func) => ({
          ...meter,
          external_id: func,
          aggregation: { func, property: 'token-count' },
          unit: 'custom' as const,
          custom_label: '',
        })),
      ],
    },
  ],
  ['duplicate IDs', { meters: [meter, { ...meter, name: 'Other meter' }] }],
  [
    'numeric ID ordering',
    {
      meters: ['10', '2', '0'].map((external_id) => ({
        ...meter,
        external_id,
      })),
    },
  ],
  [
    'benefits linked to meters',
    {
      meters: [meter],
      benefits: [
        {
          external_id: 'custom_servers',
          type: 'feature_flag',
          description: 'Custom servers',
        },
        {
          external_id: 'included_tokens',
          type: 'meter_credit',
          description: 'Included tokens',
          properties: {
            meter: 'tokens',
            units: 1000,
            rollover: false,
          },
        },
        {
          external_id: 'rollover_tokens',
          type: 'meter_credit',
          description: 'Rollover tokens',
          properties: {
            meter: 'tokens',
            units: 50,
            rollover: true,
          },
        },
      ],
    },
  ],
  ['empty benefits', { meters: [], benefits: [] }],
  [
    'duplicate benefit IDs',
    {
      meters: [],
      benefits: ['First', 'Second'].map((description) => ({
        external_id: 'flag',
        type: 'feature_flag' as const,
        description,
      })),
    },
  ],
  [
    'products with every price type',
    api
      .defineConfig({
        meters: ({ meter }) => ({
          tokens: meter('Tokens').count(),
          calls: meter('Calls').count(),
        }),
        benefits: ({ flag }) => ({ custom_servers: flag('Custom servers') }),
        products: ({ product, free, fixed, seats, units, tier, meter }) => {
          return {
            hobby: product('Hobby')
              .prices(
                free(),
                meter('calls')
                  .flat()
                  .amount(api.perThousand(api.lira(1.5)), api.eur(0.02)),
                meter('tokens').graduated(
                  tier()
                    .max(1_000_000)
                    .amount(
                      api.per(1_000_000_000, api.lira(0.75)),
                      api.per(10, api.eur(0.01)),
                    ),
                  tier().amount(
                    api.per(1_000_000_000_000, api.lira(0.01)),
                    api.perMillion(api.eur(0.03)),
                  ),
                ),
              )
              .recurring('monthly'),
            free_eur: product('Free EUR')
              .prices(fixed().amount(api.eur(0)))
              .once(),
            lifetime: product('Lifetime')
              .prices(fixed().amount(api.usd(99), api.eur(95)))
              .once(),
            team: product('Team')
              .prices(
                seats()
                  .graduated(
                    tier().max(5).amount(api.usd(20), api.eur(18)),
                    tier().amount(api.usd(15), api.eur(14)),
                  )
                  .min(3)
                  .max(50),
                meter('tokens')
                  .volume(
                    tier()
                      .max(1_000_000)
                      .amount(api.perMillion(api.usd(0.03)), api.eur(0.01)),
                    tier().amount(api.usd(0), api.eur(0)),
                  )
                  .cap(api.usd(500)),
              )
              .recurring(3, 'months')
              .trial(1, 'month')
              .grants(['custom_servers']),
            starter: product('Starter')
              .prices(
                units().graduated(
                  tier().included(10),
                  tier().max(20).free(),
                  tier().max(50).amount(api.usd(0.05)),
                  tier().free(),
                ),
                meter('tokens').volume(
                  tier().max(5).amount(api.usd(0)),
                  tier().amount(api.usd(0)),
                ),
              )
              .recurring('monthly'),
            devices: product('Devices')
              .prices(
                units().flat().min(2).amount(api.currency('nok')(50)).max(10),
              )
              .recurring('yearly')
              .trial(14, 'days')
              .description('Billed per device, "yearly".\nCancel anytime.')
              .visibility('private'),
          }
        },
      })
      .toJSON(),
  ],
  [
    'special IDs and strings',
    {
      meters: ['__proto__', 'constructor', '"\\\n` ${notCode}'].map(
        (external_id) => ({
          ...meter,
          external_id,
          name: external_id,
          aggregation: { func: 'sum', property: external_id },
          unit: 'custom',
          custom_label: external_id,
        }),
      ),
    },
  ],
]

test.each(cases)(
  'round-trips %s through executable generated code',
  async (_, config) => {
    const source = await Effect.runPromise(generateConfig(config))
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    })
    const exports: { default?: Config } = {}
    const require = (specifier: string) => {
      expect(specifier).toBe('@polar-sh/polar')
      return api
    }
    new Function('require', 'exports', compiled.outputText)(require, exports)
    expect(exports.default?.toJSON()).toEqual(config)
  },
)

test('generated modules typecheck against the public API', async () => {
  const sources = new Map(
    await Promise.all(
      cases.map(
        async ([, config], index) =>
          [
            resolve(import.meta.dirname, `generated-${index}.ts`),
            (await Effect.runPromise(generateConfig(config))).replace(
              "from '@polar-sh/polar'",
              "from './index'",
            ),
          ] as const,
      ),
    ),
  )
  const options: ts.CompilerOptions = {
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const source = sources.get(fileName)
    return source === undefined
      ? getSourceFile(
          fileName,
          languageVersion,
          onError,
          shouldCreateNewSourceFile,
        )
      : ts.createSourceFile(fileName, source, languageVersion, true)
  }
  const program = ts.createProgram([...sources.keys()], options, host)
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    )
  expect(diagnostics).toEqual([])
})

test('renders free tiers with free() and included()', async () => {
  const source = await Effect.runPromise(
    generateConfig(
      api
        .defineConfig({
          meters: () => ({}),
          products: ({ product, seats, tier }) => ({
            team: product('Team')
              .prices(
                seats().graduated(
                  tier().included(3),
                  tier().max(10).amount(api.usd(1)),
                  tier().max(20).free(),
                  tier().amount(api.usd(0.5)),
                ),
              )
              .recurring('monthly'),
          }),
        })
        .toJSON(),
    ),
  )
  expect(source).toContain('tier().included(3),')
  expect(source).toContain('tier().max(20).free(),')
})

test('renders free volume tiers without included()', async () => {
  const source = await Effect.runPromise(
    generateConfig(
      api
        .defineConfig({
          meters: () => ({}),
          products: ({ product, seats, tier }) => ({
            team: product('Team')
              .prices(
                seats().volume(
                  tier().max(3).free(),
                  tier().amount(api.usd(100)),
                ),
              )
              .recurring('monthly'),
          }),
        })
        .toJSON(),
    ),
  )
  expect(source).toContain('tier().max(3).free(),')
  expect(source).not.toContain('included(')
})

test('generates rates padded with trailing zeros', async () => {
  const source = await Effect.runPromise(
    generateConfig({
      meters: [meter],
      products: [
        {
          external_id: 'pro',
          name: 'Pro',
          recurring_interval: 'month',
          recurring_interval_count: 1,
          prices: [
            {
              amount_type: 'metered_unit',
              price_currency: 'usd',
              meter: 'tokens',
              unit_amount: '10000.000000000000',
            },
          ],
          benefits: [],
        },
      ],
    }),
  )
  expect(source).toContain('.amount(usd(100))')
})

test('rejects rates with more digits than whole amounts can hold', async () => {
  await expect(
    Effect.runPromise(
      generateConfig({
        meters: [meter],
        products: [
          {
            external_id: 'pro',
            name: 'Pro',
            recurring_interval: 'month',
            recurring_interval_count: 1,
            prices: [
              {
                amount_type: 'metered_unit',
                price_currency: 'usd',
                meter: 'tokens',
                unit_amount: '123456.000000000001',
              },
            ],
            benefits: [],
          },
        ],
      }),
    ),
  ).rejects.toThrow('too many digits')
})

test('rejects invalid input before generating code', async () => {
  await expect(
    Effect.runPromise(
      generateConfig({
        meters: [{ ...meter, filter: { conjunction: 'qwe', clauses: [] } }],
      }),
    ),
  ).rejects.toThrow()
})

test('groups interleaved currencies into one builder call per price', async () => {
  const source = await Effect.runPromise(
    generateConfig({
      meters: [],
      products: [
        {
          external_id: 'pro',
          name: 'Pro',
          recurring_interval: 'month',
          recurring_interval_count: 1,
          prices: [
            { amount_type: 'fixed', price_currency: 'usd', price_amount: 100 },
            {
              amount_type: 'seat_based',
              price_currency: 'usd',
              tiers: { type: 'volume', tiers: [{ unit_amount: '10' }] },
            },
            { amount_type: 'fixed', price_currency: 'eur', price_amount: 90 },
            {
              amount_type: 'seat_based',
              price_currency: 'eur',
              tiers: { type: 'volume', tiers: [{ unit_amount: '9' }] },
            },
          ],
          benefits: [],
        },
      ],
    }),
  )
  expect(source).toContain('fixed().amount(usd(1), eur(0.9))')
  expect(source).toContain('.amount(usd(0.1), eur(0.09))')
})
