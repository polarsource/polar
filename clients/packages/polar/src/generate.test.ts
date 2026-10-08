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
          properties: {},
        },
        {
          external_id: 'included_tokens',
          type: 'meter_credit',
          description: 'Included tokens',
          properties: {
            meter_external_id: 'tokens',
            units: 1000,
            rollover: false,
          },
        },
        {
          external_id: 'rollover_tokens',
          type: 'meter_credit',
          description: 'Rollover tokens',
          properties: {
            meter_external_id: 'tokens',
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
        properties: {},
      })),
    },
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

test('rejects invalid input before generating code', async () => {
  await expect(
    Effect.runPromise(
      generateConfig({
        meters: [{ ...meter, filter: { conjunction: 'qwe', clauses: [] } }],
      }),
    ),
  ).rejects.toThrow()
})
