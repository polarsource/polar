import { compileExpression, validateMap } from './map'
import type { PluginDef } from './plugin'

export type Json =
  | null
  | string
  | number
  | boolean
  | readonly Json[]
  | { readonly [key: string]: Json }
export type Metadata = { readonly [key: string]: Json }

export interface EventDef<M extends Metadata = Metadata> {
  readonly kind: 'event'
  readonly name: string
  /** Type-only metadata declaration; never emitted or validated at runtime. */
  readonly _metadata?: M
}
export type MetadataOf<E extends EventDef> = NonNullable<E['_metadata']>

export function event<M extends Metadata = Record<never, never>>(
  name: string,
): EventDef<M> {
  if (name === '') throw new Error('event: empty name')
  return { kind: 'event', name }
}

type Operator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'not_like'
export interface Comparison {
  readonly op: Operator
  readonly value: string | number | boolean
}
/** One value or comparison per property, or several comparisons that must all hold. */
export type Matcher<S extends Metadata> = {
  [K in keyof S & string]?:
    | string
    | number
    | boolean
    | Comparison
    | readonly Comparison[]
}

export interface Filter<E extends EventDef = EventDef> {
  readonly kind: 'filter'
  readonly event: E
  readonly where: Matcher<MetadataOf<E>>
}

const compare =
  (op: Operator) =>
  (value: string | number | boolean): Comparison => ({ op, value })
export const gt = compare('gt')
export const gte = compare('gte')
export const lt = compare('lt')
export const lte = compare('lte')
export const not = compare('ne')
export const like = compare('like')

/** `on(aiCall, { status: 'ok' })`: the event plus property matchers. */
export const on = <E extends EventDef>(
  event: E,
  where: Matcher<MetadataOf<E>> = {},
): Filter<E> => ({
  kind: 'filter',
  event,
  where,
})

export interface MappedSource<E extends EventDef = EventDef> {
  readonly kind: 'map'
  readonly filter: Filter<E>
  readonly map: Metadata
}

type MappedValue<M extends Metadata, V extends Json> = V extends `$${infer K}`
  ? K extends keyof M
    ? M[K] | null
    : number | null
  : V extends `${string}$${string}`
    ? number | null
    : V
export type MappedMetadata<M extends Metadata, Projection extends Metadata> = {
  readonly [K in keyof Projection]: MappedValue<M, Projection[K]>
}

/** Project user metadata after filtering, before aggregation. */
export function map<E extends EventDef, const Projection extends Metadata>(
  source: E | Filter<E>,
  projection: Projection,
): MappedSource<EventDef<MappedMetadata<MetadataOf<E>, Projection>>> {
  validateMap(projection)
  // Event names and filter clauses refer to the original event. The metadata
  // type carried onward describes the projected input to the aggregation.
  return {
    kind: 'map',
    filter: toFilter(source) as unknown as Filter<
      EventDef<MappedMetadata<MetadataOf<E>, Projection>>
    >,
    map: projection,
  }
}

type Source<E extends EventDef = EventDef> = E | Filter<E> | MappedSource<E>

const toFilter = <E extends EventDef>(source: Source<E>): Filter<E> =>
  source.kind === 'map'
    ? source.filter
    : source.kind === 'filter'
      ? source
      : on(source)

type NumericKeys<S extends Metadata> = {
  [K in keyof S & string]: NonNullable<S[K]> extends number ? K : never
}[keyof S & string]

export type Aggregation =
  | { readonly func: 'count' }
  | { readonly func: 'sum' | 'max' | 'min'; readonly property: string }
  | { readonly func: 'first' | 'last' }

export interface ReducerDef<
  Key extends string | undefined = string,
  E extends EventDef = EventDef,
  A extends Aggregation = Aggregation,
> {
  readonly kind: 'reducer'
  /** Undefined only for a reducer declared inline under a meter. */
  readonly key: Key
  readonly filter: Filter<E>
  readonly aggregation: A
  readonly map?: Metadata
}

export type ScalarReducer<
  Key extends string | undefined = string,
  E extends EventDef = EventDef,
> = ReducerDef<Key, E, Exclude<Aggregation, { func: 'first' | 'last' }>>
export type RecordReducer<
  Key extends string | undefined = string,
  E extends EventDef = EventDef,
> = ReducerDef<Key, E, { func: 'first' | 'last' }>

export interface DerivedReducer<Key extends string = string> {
  readonly kind: 'reducer'
  readonly key: Key
  readonly inputs: Readonly<Record<string, ScalarReducer>>
  readonly aggregation: { readonly func: 'derive'; readonly expression: string }
}

export type AnyReducer = ReducerDef | DerivedReducer

/** Compute a scalar from named event reducers. Derived inputs cannot be nested. */
export function derive<Key extends string>(
  key: Key,
  inputs: Readonly<Record<string, ScalarReducer>>,
  expression: string,
): DerivedReducer<Key> {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(key)) throw new Error('derive: invalid key')
  if (expression.length > 4096)
    throw new Error('derive: expression is too long')
  const references = new Set(
    compileExpression(expression)
      .filter(([op]) => op === 'ref')
      .map(([, name]) => name),
  )
  const names = Object.keys(inputs)
  if (
    !names.length ||
    references.size !== names.length ||
    names.some((name) => !references.has(name))
  )
    throw new Error('derive: expression references must match the named inputs')
  for (const [name, source] of Object.entries(inputs)) {
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ||
      !source.key ||
      source.kind !== 'reducer' ||
      !['count', 'sum', 'min', 'max'].includes(source.aggregation.func)
    )
      throw new Error('derive: inputs must be named event scalar reducers')
  }
  return {
    kind: 'reducer',
    key,
    inputs: { ...inputs },
    aggregation: { func: 'derive', expression },
  }
}

const reducer = <
  Key extends string | undefined,
  E extends EventDef,
  A extends Aggregation,
>(
  key: Key,
  source: Source<E>,
  aggregation: A,
): ReducerDef<Key, E, A> => {
  if (key === '') throw new Error('reducer: empty key')
  return {
    kind: 'reducer',
    key,
    filter: toFilter(source),
    ...(source.kind === 'map' && { map: source.map }),
    aggregation,
  }
}

/** An inline reducer acquires its key when attached to a meter. */
export type UnnamedReducer<
  E extends EventDef = EventDef,
  A extends Aggregation = Aggregation,
> = ReducerDef<undefined, E, A>

function keyed<const A extends Aggregation>(aggregation: A) {
  function make<Key extends string, E extends EventDef>(
    key: Key,
    source: Source<E>,
  ): ReducerDef<Key, E, A>
  function make<E extends EventDef>(source: Source<E>): UnnamedReducer<E, A>
  function make(
    ...args: [string, Source] | [Source]
  ): ReducerDef<string | undefined, EventDef, A> {
    return args.length === 1
      ? reducer(undefined, args[0], aggregation)
      : reducer(args[0], args[1], aggregation)
  }
  return make
}

export const count = keyed({ func: 'count' })
export const first = keyed({ func: 'first' })
export const last = keyed({ func: 'last' })

// The property name stays a literal so callers can tell it apart from the
// event's other fields, as an adopted ledger's spend metadata does.
function property<F extends 'sum' | 'max' | 'min'>(func: F) {
  function make<
    Key extends string,
    E extends EventDef,
    P extends NumericKeys<MetadataOf<E>>,
  >(
    key: Key,
    source: Source<E>,
    property: P,
  ): ReducerDef<Key, E, { func: F; property: P }>
  function make<E extends EventDef, P extends NumericKeys<MetadataOf<E>>>(
    source: Source<E>,
    property: P,
  ): UnnamedReducer<E, { func: F; property: P }>
  function make(
    ...args: [string, Source, string] | [Source, string]
  ): ReducerDef<string | undefined, EventDef, { func: F; property: string }> {
    return args.length === 2
      ? reducer(undefined, args[0], { func, property: args[1] })
      : reducer(args[0], args[1], { func, property: args[2] })
  }
  return make
}

export const sum = property('sum')
export const max = property('max')
export const min = property('min')

export interface Price {
  /** Price per unit of the reducer's value, in major currency units. */
  readonly amount: number
  readonly currency?: string
}

/** An amount in major units of one currency, as `usd(49)` produces. */
export interface Money extends Price {
  readonly currency: string
}

/** `money('usd', 49)`: forty-nine dollars. Fractions are fine for per-unit prices. */
export const money = (currency: string, amount: number): Money => {
  if (!/^[a-z]{3}$/.test(currency))
    throw new Error(
      `money: currency must be a three-letter code, got ${currency}`,
    )
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error(
      `money: amount must be a non-negative number, got ${amount}`,
    )
  return { amount, currency }
}
export const usd = (amount: number): Money => money('usd', amount)

export interface MeterDef<
  Key extends string = string,
  R extends ScalarReducer = ScalarReducer,
> {
  readonly kind: 'meter'
  /** The stable slug used to identify the meter across deployments. */
  readonly key: Key
  readonly reducer: R
  /** An existing named sum reducer supplying credits. Otherwise deployment creates one for credit.granted. */
  readonly creditReducer?: ScalarReducer
  readonly price: Price
}

/**
 * A meter prices a scalar reducer. The reducer may be declared inline, in
 * which case it takes the meter's key, or be one already exported.
 */
export function meter<
  Key extends string,
  E extends EventDef,
  A extends ScalarReducer['aggregation'],
>(
  key: Key,
  options: {
    reducer: UnnamedReducer<E, A>
    creditReducer?: ScalarReducer
    price: Price
  },
): MeterDef<Key, ReducerDef<Key, E, A>>
export function meter<Key extends string, R extends ScalarReducer>(
  key: Key,
  options: { reducer: R; creditReducer?: ScalarReducer; price: Price },
): MeterDef<Key, R>
export function meter(
  key: string,
  options: {
    reducer: ScalarReducer | ScalarReducer<undefined>
    creditReducer?: ScalarReducer
    price: Price
  },
): MeterDef {
  if (
    'inputs' in options.reducer ||
    (options.creditReducer && 'inputs' in options.creditReducer)
  )
    throw new Error('Derived reducers are available for metrics only')
  if (key === '') throw new Error('meter: empty key')
  if (options.price.amount < 0) throw new Error(`meter ${key}: negative price`)
  if (
    options.creditReducer &&
    (!options.creditReducer.key ||
      options.creditReducer.aggregation.func !== 'sum')
  )
    throw new Error(`meter ${key}: creditReducer must be a named sum reducer`)
  const reducer =
    options.reducer.key === undefined
      ? { ...options.reducer, key }
      : options.reducer
  return {
    kind: 'meter',
    key,
    reducer,
    price: options.price,
    ...(options.creditReducer && { creditReducer: options.creditReducer }),
  }
}

export type Limit = 'hard' | 'soft' | 'unlimited'

/**
 * A product's terms on one meter: the credits granted at the start of every
 * period, whether the balance caps usage, and how much unused credit carries
 * over. The meter's own price bills whatever runs past the included credits.
 */
export interface ProductMeterDef<M extends MeterDef = MeterDef> {
  readonly kind: 'productMeter'
  readonly meter: M
  readonly included: number
  /** soft bills the overage; hard denies once spent; unlimited never caps. */
  readonly limit: Limit
  /** Unused credit carried into the next period; null carries all of it. */
  readonly rolloverCap: number | null
}

export const isProductMeter = (value: unknown): value is ProductMeterDef =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'productMeter'

/** `included(tokens, 10_000)`: ten thousand credits a period, denied past that. */
export function included<M extends MeterDef>(
  meter: M,
  amount: number,
  options: { limit?: 'hard' | 'soft'; rolloverCap?: number | null } = {},
): ProductMeterDef<M> {
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error(
      `included: ${meter.key} needs a non-negative amount, got ${amount}`,
    )
  const rolloverCap =
    options.rolloverCap === undefined ? 0 : options.rolloverCap
  if (
    rolloverCap !== null &&
    (!Number.isFinite(rolloverCap) || rolloverCap < 0)
  )
    throw new Error(
      `included: ${meter.key} needs a non-negative rollover cap, got ${rolloverCap}`,
    )
  return {
    kind: 'productMeter',
    meter,
    included: amount,
    limit: options.limit ?? 'hard',
    rolloverCap,
  }
}

/** `unlimited(tokens)`: never capped, no credits; the meter's price still bills usage. */
export const unlimited = <M extends MeterDef>(
  meter: M,
): ProductMeterDef<M> => ({
  kind: 'productMeter',
  meter,
  included: 0,
  limit: 'unlimited',
  rolloverCap: 0,
})

/** A bare meter on a product is pay per use: nothing included, never denied. */
export const productMeter = (
  term: MeterDef | ProductMeterDef,
): ProductMeterDef =>
  isProductMeter(term)
    ? term
    : {
        kind: 'productMeter',
        meter: term,
        included: 0,
        limit: 'soft',
        rolloverCap: 0,
      }

export interface EntitlementDef<Key extends string = string> {
  readonly kind: 'entitlement'
  /** The stable slug an identity holds while a granting product is active. */
  readonly key: Key
  readonly name?: string
  readonly description?: string
}

/**
 * A boolean feature flag granted by products. Held by an identity while any
 * subscription of its chain to a granting product is active.
 */
export function entitlement<Key extends string>(
  key: Key,
  options: { name?: string; description?: string } = {},
): EntitlementDef<Key> {
  if (key === '') throw new Error('entitlement: empty key')
  return {
    kind: 'entitlement',
    key,
    ...(options.name !== undefined && { name: options.name }),
    ...(options.description !== undefined && {
      description: options.description,
    }),
  }
}

export type BillingInterval = 'day' | 'week' | 'month' | 'year'

export interface RecurringPrice {
  readonly type: 'recurring'
  readonly interval: BillingInterval
  readonly intervalCount: number
  readonly amount: Money
}
export interface OneTimePrice {
  readonly type: 'one_time'
  readonly amount: Money
}
export type ProductPrice = RecurringPrice | OneTimePrice

/** A fixed amount every interval; attached meters bill their usage at each boundary. */
export const recurring = (options: {
  interval: BillingInterval
  intervalCount?: number
  amount: Money
}): RecurringPrice => {
  const intervalCount = options.intervalCount ?? 1
  if (!Number.isInteger(intervalCount) || intervalCount < 1)
    throw new Error('recurring: intervalCount must be a positive integer')
  return {
    type: 'recurring',
    interval: options.interval,
    intervalCount,
    amount: options.amount,
  }
}

/** Paid once; grants its entitlements from the order onward. Cannot carry meters. */
export const oneTime = (options: { amount: Money }): OneTimePrice => ({
  type: 'one_time',
  amount: options.amount,
})

export interface ProductDef<
  Key extends string = string,
  P extends ProductPrice = ProductPrice,
> {
  readonly kind: 'product'
  /** The stable slug; a changed definition becomes a new generation on deploy. */
  readonly key: Key
  readonly name: string
  readonly description?: string
  readonly price: P
  /** Each meter with this product's terms on it. Recurring products only. */
  readonly meters: readonly ProductMeterDef[]
  readonly entitlements: readonly EntitlementDef[]
}

export function product<Key extends string, P extends ProductPrice>(
  key: Key,
  options: {
    name: string
    description?: string
    price: P
    /**
     * Bare meters are pay per use; wrap one in `included` or `unlimited` for
     * terms. A term wins over a bare listing of the same meter, so a plugin's
     * whole table can be spread after the few meters with terms:
     * `[included(ai.models[m].output, 200_000), ...ai.meters]`.
     */
    meters?: readonly (MeterDef | ProductMeterDef)[]
    entitlements?: readonly EntitlementDef[]
  },
): ProductDef<Key, P> {
  if (key === '') throw new Error('product: empty key')
  if (options.name.trim() === '')
    throw new Error(`product ${key}: name is required`)
  const listed = options.meters ?? []
  if (options.price.type === 'one_time' && listed.length > 0)
    throw new Error(
      `product ${key}: a one-time product cannot carry meters; nothing cycles`,
    )
  // Keyed by meter: a term wins over a bare listing, wherever each was
  // listed; a second bare listing is a no-op; a second term is a mistake.
  const byKey = new Map<string, ProductMeterDef>()
  const withTerms = new Set<string>()
  for (const entry of listed) {
    const term = productMeter(entry)
    const slug = term.meter.key
    if (!isProductMeter(entry)) {
      if (!byKey.has(slug)) byKey.set(slug, term)
      continue
    }
    if (withTerms.has(slug))
      throw new Error(`product ${key}: meter ${slug} has terms listed twice`)
    withTerms.add(slug)
    byKey.set(slug, term)
  }
  const meters = [...byKey.values()]
  for (const { meter } of meters) {
    const currency = meter.price.currency ?? DEFAULT_CURRENCY
    if (currency !== options.price.amount.currency)
      throw new Error(
        `product ${key}: meter ${meter.key} bills in ${currency}, product in ${options.price.amount.currency}`,
      )
  }
  return {
    kind: 'product',
    key,
    name: options.name,
    ...(options.description !== undefined && {
      description: options.description,
    }),
    price: options.price,
    meters,
    entitlements: options.entitlements ?? [],
  }
}

export const DEFAULT_CURRENCY = 'usd'

export type DurationUnit = 'minute' | 'hour' | 'day'

/** A rolling window of meter events. Named `recent` so it does not collide with `last`. */
export interface SignalWindow {
  readonly kind: 'window'
  readonly amount: number
  readonly unit: DurationUnit
}

const UNITS: ReadonlySet<string> = new Set(['minute', 'hour', 'day'])
const WINDOW_MS: Record<DurationUnit, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
}
const MAX_WINDOW_MS = 7 * WINDOW_MS.day

export function recent(amount: number, unit: DurationUnit): SignalWindow {
  if (!Number.isInteger(amount) || amount <= 0)
    throw new Error('recent: amount must be a positive integer')
  if (!UNITS.has(unit))
    throw new Error('recent: unit must be minute, hour, or day')
  if (amount * WINDOW_MS[unit] > MAX_WINDOW_MS)
    throw new Error('recent: window must be at most 7 days')
  return { kind: 'window', amount, unit }
}

export interface MeterSignalOptions {
  readonly meter: MeterDef
  /** Which balance figure the thresholds apply to. Only `remaining` today. */
  readonly field: 'remaining'
  /** The signal becomes active when the field drops below this. */
  readonly enter: { readonly below: number }
  /** The signal becomes inactive again once the field is at least this. */
  readonly exit: { readonly atLeast: number }
}

export interface SemanticSignalOptions {
  /** The meter whose recent events Jev reads. */
  readonly meter: MeterDef
  /** The question Polar asks Jev, verbatim. Deployed so the judge endpoint resolves it by key. */
  readonly when: string
  /** How far back the events go. Defaults to `recent(1, 'hour')`. */
  readonly over?: SignalWindow
  /** Active when the noul rises above this. */
  readonly enter: { readonly above: number }
  /** Inactive again once the noul falls below this. */
  readonly exit: { readonly below: number }
}

export type SemanticSignalDefinition = Required<SemanticSignalOptions> & {
  readonly kind: 'semantic'
}

export type MeterSignalDefinition = MeterSignalOptions & {
  readonly kind: 'meter'
}

export type SignalOptions = MeterSignalOptions | SemanticSignalOptions

interface SignalBase {
  readonly kind: 'signal'
  readonly key: string
}

export interface MeterSignalRef extends SignalBase {
  readonly definition: MeterSignalDefinition
}

export interface SemanticSignalRef extends SignalBase {
  readonly definition: SemanticSignalDefinition
}

export type SignalRef = MeterSignalRef | SemanticSignalRef

export const isMeterSignal = (ref: SignalRef): ref is MeterSignalRef =>
  ref.definition.kind === 'meter'

export const isSemanticSignal = (ref: SignalRef): ref is SemanticSignalRef =>
  ref.definition.kind === 'semantic'

const SLUG_KEY = /^[a-z0-9][a-z0-9_-]{0,127}$/

function meterSignal(key: string, options: MeterSignalOptions): MeterSignalRef {
  if (options.field !== 'remaining') {
    throw new Error('signal: field must be the remaining balance of a meter')
  }
  if (
    !Number.isFinite(options.enter.below) ||
    options.enter.below <= 0 ||
    !Number.isFinite(options.exit.atLeast) ||
    options.exit.atLeast <= options.enter.below
  ) {
    throw new Error(
      'signal: thresholds must be finite, with 0 < enter.below < exit.atLeast',
    )
  }
  return {
    kind: 'signal',
    key,
    definition: {
      kind: 'meter',
      meter: options.meter,
      field: options.field,
      enter: { ...options.enter },
      exit: { ...options.exit },
    },
  }
}

function semanticSignal(
  key: string,
  options: SemanticSignalOptions,
): SemanticSignalRef {
  const when = options.when.trim()
  if (!when || when.length > 512) {
    throw new Error('signal: when must be 1 to 512 characters')
  }
  // Re-running `recent` validates and copies a window built by hand.
  const over = options.over
    ? recent(options.over.amount, options.over.unit)
    : recent(1, 'hour')
  if (
    !Number.isFinite(options.enter.above) ||
    !Number.isFinite(options.exit.below) ||
    options.exit.below <= 0 ||
    options.enter.above > 1 ||
    options.enter.above <= options.exit.below
  ) {
    throw new Error(
      'signal: thresholds must be finite, with 0 < exit.below < enter.above <= 1',
    )
  }
  return {
    kind: 'signal',
    key,
    definition: {
      kind: 'semantic',
      meter: options.meter,
      when,
      over,
      enter: { ...options.enter },
      exit: { ...options.exit },
    },
  }
}

export function signal(key: string, options: MeterSignalOptions): MeterSignalRef
export function signal(
  key: string,
  options: SemanticSignalOptions,
): SemanticSignalRef
export function signal(key: string, options: SignalOptions): SignalRef
export function signal(key: string, options: SignalOptions): SignalRef {
  if (!SLUG_KEY.test(key)) {
    throw new Error('signal: key must be a slug of at most 128 characters')
  }
  if (!options || !isMeter(options.meter))
    throw new Error('signal: a meter is required')
  return 'when' in options
    ? semanticSignal(key, options)
    : meterSignal(key, options)
}

export interface ActivityDef<Key extends string = string> {
  readonly kind: 'activity'
  readonly key: Key
  readonly event: EventDef
  readonly span: string
}

const SLUG = /^[a-z0-9][a-z0-9_-]*$/

/** What a plugin asks for when it wants its completions classified. */
export type ClassifyOptions =
  | boolean
  | {
      /** Metadata key that makes one span. Defaults to `call_id`. */
      readonly span?: string
    }

/**
 * A plugin's classifier over the completion event it records. Polar labels
 * each span after ingest; labels never move money. Not a standalone
 * definition: the taxonomy reads the metadata only an `llm()` plugin writes.
 */
export function classifier<Key extends string>(
  key: Key,
  event: EventDef,
  options: ClassifyOptions,
): ActivityDef<Key> | undefined {
  if (options === false) return undefined
  if (!SLUG.test(key)) throw new Error(`classify: invalid slug ${key}`)
  const span = options === true ? undefined : options.span
  if (span === '') throw new Error('classify: span must name a metadata key')
  return { kind: 'activity', key, event, span: span ?? 'call_id' }
}

/** Every definition a plugin may contain; everything but a plugin itself. */
export type LeafDefinition =
  | SignalRef
  | EventDef
  | ReducerDef<string | undefined>
  | DerivedReducer
  | MeterDef
  | EntitlementDef
  | ProductDef
  | ActivityDef

export type Definition = LeafDefinition | PluginDef

const KINDS: ReadonlySet<string> = new Set([
  'signal',
  'event',
  'reducer',
  'meter',
  'entitlement',
  'product',
  'activity',
  'plugin',
])

export const isMeter = (value: unknown): value is MeterDef =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'meter'

export const isDefinition = (value: unknown): value is Definition =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  typeof value.kind === 'string' &&
  KINDS.has(value.kind)
