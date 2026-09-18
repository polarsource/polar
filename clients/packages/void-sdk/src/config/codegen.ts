import type {
  Ir,
  IrClause,
  IrMeter,
  IrProduct,
  IrProductMeter,
  IrReducer,
} from './compile'
import { eventOf } from './ir'

export interface SourceOptions {
  /** Module the helpers are imported from; defaults to `@void/sdk/config`. */
  readonly from?: string
  /** Where the IR came from, named in the header: a version or a scenario. */
  readonly source?: string
}

const HELPERS = [
  'count',
  'defineConfig',
  'derive',
  'entitlement',
  'event',
  'first',
  'gt',
  'gte',
  'included',
  'last',
  'like',
  'lt',
  'lte',
  'map',
  'max',
  'meter',
  'min',
  'money',
  'not',
  'on',
  'oneTime',
  'product',
  'recent',
  'recurring',
  'signal',
  'sum',
  'unlimited',
  'usd',
] as const
type Helper = (typeof HELPERS)[number]

const RESERVED = new Set([
  ...HELPERS,
  'break',
  'case',
  'catch',
  'class',
  'config',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
])

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

const str = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
const literal = (value: string | number | boolean): string =>
  typeof value === 'string' ? str(value) : String(value)
const key = (name: string): string => (IDENTIFIER.test(name) ? name : str(name))

const camel = (slug: string): string => {
  const words = slug.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const name = words
    .map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join('')
  return /^[0-9]/.test(name) ? `_${name}` : name || '_'
}

/** Hands out unique identifiers for slugs, kind-suffixed on collision. */
class Names {
  private readonly taken = new Set<string>(RESERVED)
  private readonly byKey = new Map<string, string>()

  claim(kind: string, slug: string): string {
    const base = camel(slug)
    const candidates = [
      base,
      `${base}${kind[0]!.toUpperCase()}${kind.slice(1)}`,
    ]
    let name = candidates.find((c) => !this.taken.has(c))
    for (let i = 2; name === undefined; i++) {
      if (!this.taken.has(`${candidates[1]}${i}`)) name = `${candidates[1]}${i}`
    }
    this.taken.add(name)
    this.byKey.set(`${kind}:${slug}`, name)
    return name
  }

  of(kind: string, slug: string): string {
    const name = this.byKey.get(`${kind}:${slug}`)
    if (name === undefined) throw new Error(`${kind} ${slug} is not defined`)
    return name
  }
}

const COMPARISONS: Partial<Record<IrClause['operator'], Helper>> = {
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  ne: 'not',
  like: 'like',
}

interface Emitter {
  use(helper: Helper): Helper
}

const comparison = (clause: IrClause, e: Emitter): string => {
  if (clause.operator === 'eq') return literal(clause.value)
  const helper = COMPARISONS[clause.operator]
  return helper
    ? `${e.use(helper)}(${literal(clause.value)})`
    : `{ op: ${str(clause.operator)}, value: ${literal(clause.value)} }`
}

const where = (clauses: readonly IrClause[], e: Emitter): string => {
  const grouped = new Map<string, IrClause[]>()
  for (const clause of clauses) {
    grouped.set(clause.property, [
      ...(grouped.get(clause.property) ?? []),
      clause,
    ])
  }
  const entries = [...grouped].map(([property, list]) => {
    const values = list.map((c) => comparison(c, e))
    return `${key(property)}: ${values.length === 1 ? values[0] : `[${values.join(', ')}]`}`
  })
  return `{ ${entries.join(', ')} }`
}

const money = (amount: number, currency: string, e: Emitter): string =>
  currency === 'usd'
    ? `${e.use('usd')}(${amount})`
    : `${e.use('money')}(${str(currency)}, ${amount})`

const metadataType = (
  properties: ReadonlyMap<string, ReadonlySet<string>>,
): string =>
  properties.size === 0
    ? ''
    : `<{ ${[...properties]
        .map(
          ([name, types]) => `${key(name)}: ${[...types].sort().join(' | ')}`,
        )
        .join('; ')} }>`

/** What each event's metadata must carry for its reducers to type-check. */
const inferMetadata = (reducers: readonly IrReducer[]) => {
  const events = new Map<string, Map<string, Set<string>>>()
  const add = (event: string, property: string, type: string) => {
    const properties = events.get(event) ?? new Map<string, Set<string>>()
    properties.set(property, (properties.get(property) ?? new Set()).add(type))
    events.set(event, properties)
  }
  for (const reducer of reducers) {
    const event = eventOf(reducer)
    if (event === undefined || !reducer.filter) continue
    for (const clause of reducer.filter.clauses) {
      if (clause.property !== 'name')
        add(event, clause.property, typeof clause.value)
    }
    // A mapped reducer aggregates the projection, not the event's own field.
    if (reducer.map === undefined && 'property' in reducer.aggregation)
      add(event, reducer.aggregation.property, 'number')
  }
  return events
}

const source = (reducer: IrReducer, names: Names, e: Emitter): string => {
  const event = names.of('event', eventOf(reducer)!)
  const clauses = reducer.filter!.clauses.filter((c) => c.property !== 'name')
  const filtered =
    clauses.length === 0
      ? event
      : `${e.use('on')}(${event}, ${where(clauses, e)})`
  return reducer.map === undefined
    ? filtered
    : `${e.use('map')}(${filtered}, ${JSON.stringify(reducer.map)})`
}

/** `sum(src, 'tokens')`, or `sum('slug', src, 'tokens')` when named. */
const aggregate = (
  reducer: IrReducer,
  names: Names,
  e: Emitter,
  named: boolean,
): string => {
  const { aggregation } = reducer
  if (aggregation.func === 'derive') {
    const inputs = Object.entries(aggregation.inputs)
      .map(([name, slug]) => `${key(name)}: ${names.of('reducer', slug)}`)
      .join(', ')
    return `${e.use('derive')}(${str(reducer.slug)}, { ${inputs} }, ${str(aggregation.expression)})`
  }
  const args = [
    ...(named ? [str(reducer.slug)] : []),
    source(reducer, names, e),
    ...('property' in aggregation ? [str(aggregation.property)] : []),
  ]
  return `${e.use(aggregation.func)}(${args.join(', ')})`
}

const orWarning = (reducer: IrReducer): string[] =>
  reducer.filter?.conjunction === 'or'
    ? [
        `// TODO: the deployed filter joins its clauses with "or"; on() only expresses "and".`,
      ]
    : []

const meterTerm = (term: IrProductMeter, names: Names, e: Emitter): string => {
  const ref = names.of('meter', term.slug)
  if (term.limit === 'unlimited') return `${e.use('unlimited')}(${ref})`
  if (term.limit === 'soft' && term.included === 0 && term.rollover_cap === 0)
    return ref
  const options = [
    ...(term.limit === 'soft' ? [`limit: 'soft'`] : []),
    ...(term.rollover_cap !== 0 ? [`rolloverCap: ${term.rollover_cap}`] : []),
  ]
  return `${e.use('included')}(${ref}, ${term.included}${
    options.length ? `, { ${options.join(', ')} }` : ''
  })`
}

const price = (product: IrProduct, e: Emitter): string => {
  const { price: p } = product
  const amount = `amount: ${money(p.amount, p.currency, e)}`
  return p.type === 'one_time'
    ? `${e.use('oneTime')}({ ${amount} })`
    : `${e.use('recurring')}({ interval: ${str(p.interval)}${
        p.interval_count === 1 ? '' : `, intervalCount: ${p.interval_count}`
      }, ${amount} })`
}

const meterDefinition = (
  meter: IrMeter,
  reducers: ReadonlyMap<string, IrReducer>,
  inline: ReadonlySet<string>,
  names: Names,
  e: Emitter,
): string => {
  const usage = inline.has(meter.reducer)
    ? aggregate(reducers.get(meter.reducer)!, names, e, false)
    : names.of('reducer', meter.reducer)
  const fields = [
    `reducer: ${usage}`,
    ...(meter.credit_reducer
      ? [`creditReducer: ${names.of('reducer', meter.credit_reducer)}`]
      : []),
    `price: ${money(meter.unit_amount, meter.currency, e)}`,
  ]
  return `${e.use('meter')}(${str(meter.slug)}, {\n  ${fields.join(',\n  ')},\n})`
}

/**
 * Best-effort TypeScript for an IR, in one canonical form per definition.
 * The result compiles back to the same IR except where a comment says
 * otherwise. Meter names, plugins and event storage are not part of
 * the deployed configuration and are not recovered.
 */
export const toSource = (ir: Ir, options: SourceOptions = {}): string => {
  const used = new Set<Helper>(['defineConfig'])
  const e: Emitter = {
    use: (helper) => {
      used.add(helper)
      return helper
    },
  }
  const names = new Names()
  const reducers = new Map(ir.reducers.map((r) => [r.slug, r]))
  const referenced = new Set([
    ...ir.meters.flatMap((m) => (m.credit_reducer ? [m.credit_reducer] : [])),
    ...ir.reducers.flatMap((r) =>
      r.aggregation.func === 'derive'
        ? Object.values(r.aggregation.inputs)
        : [],
    ),
  ])
  // A reducer owned by the meter of the same slug is written inline under it.
  const inline = new Set(
    ir.meters
      .filter(
        (m) =>
          m.reducer === m.slug &&
          !referenced.has(m.slug) &&
          reducers.get(m.slug)?.aggregation.func !== 'derive' &&
          ir.meters.filter((o) => o.reducer === m.slug).length === 1,
      )
      .map((m) => m.slug),
  )
  const metadata = inferMetadata(ir.reducers)
  const exported: string[] = []
  const blocks: string[] = []
  const define = (
    kind: string,
    slug: string,
    body: string,
    notes: string[] = [],
  ) => {
    const name = names.claim(kind, slug)
    exported.push(name)
    blocks.push([...notes, `export const ${name} = ${body}`].join('\n'))
  }

  for (const event of ir.events) {
    define(
      'event',
      event.name,
      `${e.use('event')}${metadataType(metadata.get(event.name) ?? new Map())}(${str(event.name)})`,
    )
  }
  const named = ir.reducers.filter((r) => !inline.has(r.slug))
  for (const reducer of named.filter((r) => r.aggregation.func !== 'derive'))
    define(
      'reducer',
      reducer.slug,
      aggregate(reducer, names, e, true),
      orWarning(reducer),
    )
  for (const reducer of named.filter((r) => r.aggregation.func === 'derive'))
    define('reducer', reducer.slug, aggregate(reducer, names, e, true))
  for (const meter of ir.meters) {
    define(
      'meter',
      meter.slug,
      meterDefinition(meter, reducers, inline, names, e),
      inline.has(meter.reducer) ? orWarning(reducers.get(meter.reducer)!) : [],
    )
  }
  for (const entitlement of ir.entitlements) {
    const options = [
      ...(entitlement.name !== undefined
        ? [`name: ${str(entitlement.name)}`]
        : []),
      ...(entitlement.description !== undefined
        ? [`description: ${str(entitlement.description)}`]
        : []),
    ]
    define(
      'entitlement',
      entitlement.slug,
      `${e.use('entitlement')}(${str(entitlement.slug)}${
        options.length ? `, { ${options.join(', ')} }` : ''
      })`,
    )
  }
  for (const product of ir.products) {
    const fields = [
      `name: ${str(product.name)}`,
      ...(product.description !== undefined
        ? [`description: ${str(product.description)}`]
        : []),
      `price: ${price(product, e)}`,
      ...(product.meters.length
        ? [
            `meters: [\n    ${product.meters
              .map((t) => meterTerm(t, names, e))
              .join(',\n    ')},\n  ]`,
          ]
        : []),
      ...(product.entitlements.length
        ? [
            `entitlements: [${product.entitlements
              .map((slug) => names.of('entitlement', slug))
              .join(', ')}]`,
          ]
        : []),
    ]
    define(
      'product',
      product.slug,
      `${e.use('product')}(${str(product.slug)}, {\n  ${fields.join(',\n  ')},\n})`,
    )
  }
  for (const activity of ir.activities ?? []) {
    // A classifier belongs to the llm plugin that records its event, and
    // plugins are not recovered; leave the instruction instead.
    const option =
      activity.group_by === 'call_id'
        ? 'classify: true'
        : `classify: { span: ${str(activity.group_by)} }`
    blocks.push(
      `// TODO: ${activity.slug} classifies ${activity.event}; set ${option} on the llm plugin with key ${str(activity.slug)}.`,
    )
  }
  for (const signal of ir.signals ?? []) {
    const meterName = names.of('meter', signal.meter)
    const fields =
      signal.kind === 'meter'
        ? [
            `meter: ${meterName}`,
            `field: 'remaining'`,
            `enter: { below: ${signal.enter_below} }`,
            `exit: { atLeast: ${signal.exit_at_least} }`,
          ]
        : [
            `meter: ${meterName}`,
            `when: ${str(signal.when)}`,
            ...(signal.over.amount === 1 && signal.over.unit === 'hour'
              ? []
              : [
                  `over: ${e.use('recent')}(${signal.over.amount}, ${str(
                    signal.over.unit,
                  )})`,
                ]),
            `enter: { above: ${signal.enter_above} }`,
            `exit: { below: ${signal.exit_below} }`,
          ]
    define(
      'signal',
      signal.slug,
      `${e.use('signal')}(${str(signal.slug)}, {\n  ${fields.join(',\n  ')},\n})`,
    )
  }

  const header = [
    `// Pulled from Polar Void${options.source ? `: ${options.source}` : ''}.`,
    '// Best effort: meter names, plugins and event storage are',
    '// not part of the deployed configuration. Review any TODO',
    '// before deploying.',
  ]
  const imports = `import {\n${[...used]
    .sort()
    .map((h) => `  ${h},`)
    .join('\n')}\n} from ${str(options.from ?? '@void/sdk/config')}`
  const config = `export const config = defineConfig({\n  schema: { ${exported.join(', ')} },\n})`
  return [header.join('\n'), imports, ...blocks, config].join('\n\n') + '\n'
}
