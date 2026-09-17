import type {
  Ir,
  IrActivity,
  IrEntitlement,
  IrMeter,
  IrPrice,
  IrProductMeter,
  IrReducer,
} from './compile'
import type { BillingInterval } from './schema'

/**
 * The IR as it comes back from the server or a `void.json` file: decimals may
 * be strings, absent fields may be null, a product meter may be a bare slug,
 * and `version` and `events` may be missing.
 */
export interface IrInput {
  readonly version?: number
  readonly events?: ReadonlyArray<{ readonly name: string }>
  readonly reducers?: ReadonlyArray<{
    readonly slug: string
    readonly filter?: unknown
    readonly aggregation: { readonly func?: string }
    readonly map?: unknown
  }>
  readonly meters?: ReadonlyArray<
    Omit<IrMeter, 'unit_amount' | 'credit_reducer' | 'currency'> & {
      readonly unit_amount: number | string
      readonly credit_reducer?: string | null
      readonly currency?: string
    }
  >
  readonly entitlements?: ReadonlyArray<{
    readonly slug: string
    readonly name?: string | null
    readonly description?: string | null
  }>
  readonly products?: ReadonlyArray<{
    readonly slug: string
    readonly name: string
    readonly description?: string | null
    readonly price: {
      readonly type: 'recurring' | 'one_time'
      readonly interval?: BillingInterval
      readonly interval_count?: number
      readonly amount: number | string
      readonly currency: string
    }
    readonly meters?: ReadonlyArray<string | Partial<IrProductMeter>>
    readonly entitlements?: ReadonlyArray<string>
  }>
  readonly activities?: ReadonlyArray<{
    readonly slug: string
    readonly event: string
    readonly group_by?: string
    readonly run_by?: string | null
    readonly taxonomy?: string
  }>
}

const withoutNulls = <T>(value: T): T =>
  Array.isArray(value)
    ? (value.map(withoutNulls) as T)
    : typeof value === 'object' && value !== null
      ? (Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => [k, withoutNulls(v)]),
        ) as T)
      : value

const price = (p: NonNullable<IrInput['products']>[number]['price']): IrPrice =>
  p.type === 'recurring'
    ? {
        type: 'recurring',
        interval: p.interval!,
        interval_count: p.interval_count ?? 1,
        amount: Number(p.amount),
        currency: p.currency,
      }
    : { type: 'one_time', amount: Number(p.amount), currency: p.currency }

const bySlug = <T extends { slug: string }>(a: T, b: T) =>
  a.slug.localeCompare(b.slug)

const term = (entry: string | Partial<IrProductMeter>): IrProductMeter =>
  typeof entry === 'string'
    ? { slug: entry, included: 0, limit: 'hard', rollover_cap: 0 }
    : {
        slug: entry.slug!,
        included: entry.included ?? 0,
        limit: entry.limit ?? 'hard',
        rollover_cap: entry.rollover_cap === undefined ? 0 : entry.rollover_cap,
      }

/** The event a filtered reducer reads, from its `name` clause. */
export const eventOf = (reducer: IrReducer): string | undefined => {
  const clause = reducer.filter?.clauses.find(
    (c) => c.property === 'name' && c.operator === 'eq',
  )
  return typeof clause?.value === 'string' ? clause.value : undefined
}

/**
 * Brings a stored or hand-written configuration into the canonical `Ir` the
 * CLI compiles to, so `checksum` agrees with a config that defines the same
 * thing. Events are derived from the reducers when not listed.
 */
export const normalizeIr = (input: IrInput): Ir => {
  const reducers = (input.reducers ?? [])
    .map(
      (r) =>
        withoutNulls({
          ...r,
          // The server omits `func` for its default aggregation.
          aggregation: { func: 'count', ...r.aggregation },
        }) as IrReducer,
    )
    .sort(bySlug)
  const events = [
    ...new Set([
      ...(input.events ?? []).map((e) => e.name),
      ...reducers.flatMap((r) => {
        const name = eventOf(r)
        return name === undefined ? [] : [name]
      }),
      ...(input.activities ?? []).map((a) => a.event),
    ]),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name }))
  return {
    version: 4,
    events,
    reducers,
    meters: (input.meters ?? [])
      .map((m) =>
        withoutNulls({
          slug: m.slug,
          reducer: m.reducer,
          credit_reducer: m.credit_reducer ?? undefined,
          unit_amount: Number(m.unit_amount),
          currency: m.currency ?? 'usd',
        }),
      )
      .sort(bySlug),
    entitlements: (input.entitlements ?? [])
      .map((e) => withoutNulls(e) as IrEntitlement)
      .sort(bySlug),
    products: (input.products ?? [])
      .map((p) =>
        withoutNulls({
          slug: p.slug,
          name: p.name,
          description: p.description ?? undefined,
          price: price(p.price),
          meters: (p.meters ?? []).map(term).sort(bySlug),
          entitlements: [...(p.entitlements ?? [])].sort(),
        }),
      )
      .sort(bySlug),
    ...(input.activities?.length
      ? {
          activities: input.activities
            .map(
              (a) =>
                withoutNulls({
                  slug: a.slug,
                  event: a.event,
                  group_by: a.group_by ?? 'call_id',
                  run_by: a.run_by ?? undefined,
                  taxonomy: a.taxonomy ?? 'polar.agent/v1',
                }) as IrActivity,
            )
            .sort(bySlug),
        }
      : {}),
  }
}

/** Reads a `void.json`: the IR as `void pull` writes it. */
export const parseIr = (value: unknown): Ir => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('a void.json must be an object')
  const input = value as IrInput
  if (input.version !== 4)
    throw new Error(
      `a void.json must declare "version": 4, got ${JSON.stringify(input.version)}`,
    )
  for (const key of [
    'reducers',
    'meters',
    'entitlements',
    'products',
    'activities',
  ]) {
    const list = (input as Record<string, unknown>)[key]
    if (list !== undefined && !Array.isArray(list))
      throw new Error(`a void.json's ${key} must be an array`)
  }
  return normalizeIr(input)
}
