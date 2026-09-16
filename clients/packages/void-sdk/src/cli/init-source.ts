export const TEMPLATES = ['blank', 'usage', 'llm', 'credits'] as const
export const STORAGES = ['none', 'sqlite'] as const

export type Template = (typeof TEMPLATES)[number]
export type Storage = (typeof STORAGES)[number]

const configImport = (...names: string[]) => {
  const all = ['defineConfig', ...names]
  if (all.length === 1) return `import { defineConfig } from '@void/sdk/config'`
  return `import {\n  ${all.join(',\n  ')},\n} from '@void/sdk/config'`
}

const schemas: Record<
  Template,
  { imports: readonly string[]; defs: readonly string[]; schema: string }
> = {
  blank: {
    imports: [configImport()],
    defs: [],
    schema: '{}',
  },
  usage: {
    imports: [
      configImport(
        'event',
        'included',
        'meter',
        'product',
        'recurring',
        'sum',
        'usd',
      ),
    ],
    defs: [
      `export const usage = event<{ units: number }>('usage')`,
      '',
      `export const units = meter('units', {`,
      `  reducer: sum(usage, 'units'),`,
      `  price: usd(0.002),`,
      `})`,
      '',
      `export const pro = product('pro', {`,
      `  name: 'Pro',`,
      `  price: recurring({ interval: 'month', amount: usd(49) }),`,
      `  meters: [included(units, 100, { limit: 'soft' })],`,
      `})`,
    ],
    schema: '{ usage, units, pro }',
  },
  llm: {
    imports: [
      configImport('included', 'product', 'recurring', 'usd'),
      `import { llm, perToken } from '@void/sdk/plugins'`,
    ],
    defs: [
      `export const ai = llm({`,
      `  models: ['anthropic/claude-sonnet-5'],`,
      `  billing: perToken({`,
      `    'anthropic/claude-sonnet-5': {`,
      `      input: usd(0.000003),`,
      `      output: usd(0.000015),`,
      `    },`,
      `    other: { input: usd(0.000004), output: usd(0.00002) },`,
      `  }),`,
      `})`,
      '',
      `export const pro = product('pro', {`,
      `  name: 'Pro',`,
      `  price: recurring({ interval: 'month', amount: usd(49) }),`,
      `  meters: [`,
      `    included(ai.models['anthropic/claude-sonnet-5'].input, 100_000, {`,
      `      limit: 'soft',`,
      `    }),`,
      `    ai.models['anthropic/claude-sonnet-5'].output,`,
      `    ai.other.input,`,
      `    ai.other.output,`,
      `  ],`,
      `})`,
    ],
    schema: '{ ai, pro }',
  },
  credits: {
    imports: [
      configImport('included', 'product', 'recurring', 'usd'),
      `import { credits } from '@void/sdk/plugins'`,
    ],
    defs: [
      `export const wallet = credits({ price: usd(0) })`,
      '',
      `export const pro = product('pro', {`,
      `  name: 'Pro',`,
      `  price: recurring({ interval: 'month', amount: usd(19) }),`,
      `  meters: [included(wallet.credits, 10_000, { limit: 'hard' })],`,
      `})`,
    ],
    schema: '{ wallet, pro }',
  },
}

const stores: Record<
  Storage,
  { imports: readonly string[]; prelude: readonly string[]; field?: string }
> = {
  none: { imports: [], prelude: [] },
  sqlite: {
    imports: [`import { DatabaseSync } from 'node:sqlite'`],
    prelude: [`const database = new DatabaseSync('void.db')`],
    field: "eventStorage: [{ type: 'sqlite', connection: database }]",
  },
}

export const voidTs = (template: Template, storage: Storage): string => {
  const schema = schemas[template]
  const store = stores[storage]
  const imports = [...store.imports, ...schema.imports]
  const body = [
    ...schema.defs,
    ...(schema.defs.length ? [''] : []),
    'export const config = defineConfig({',
    `  schema: ${schema.schema},`,
    ...(store.field ? [`  ${store.field},`] : []),
    '})',
  ]
  return [
    ...imports,
    '',
    ...(store.prelude.length ? [...store.prelude, ''] : []),
    ...body,
    '',
  ].join('\n')
}
