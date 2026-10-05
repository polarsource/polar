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
  /** Type-only payload. It is not stored on the object. */
  readonly _metadata?: M
}

export type MetadataOf<E extends EventDef> = NonNullable<E['_metadata']>

export function event<M extends Metadata = Record<never, never>>(
  name: string,
): EventDef<M> {
  if (name === '') throw new Error('event: empty name')
  return { kind: 'event', name }
}

interface Filter<E extends EventDef = EventDef> {
  readonly kind: 'filter'
  readonly event: E
  readonly where: Readonly<Record<string, never>>
}

type NumericKeys<S extends Metadata> = {
  [K in keyof S & string]: NonNullable<S[K]> extends number ? K : never
}[keyof S & string]

export type Aggregation =
  | { readonly func: 'count' }
  | { readonly func: 'sum'; readonly property: string }

export interface ReducerDef<
  Key extends string | undefined = string,
  E extends EventDef = EventDef,
  A extends Aggregation = Aggregation,
> {
  readonly kind: 'reducer'
  /** Undefined until the reducer is attached to a meter. */
  readonly key: Key
  readonly filter: Filter<E>
  readonly aggregation: A
}

type UnnamedReducer<
  E extends EventDef = EventDef,
  A extends Aggregation = Aggregation,
> = ReducerDef<undefined, E, A>

const reducer = <E extends EventDef, A extends Aggregation>(
  source: E,
  aggregation: A,
): UnnamedReducer<E, A> => ({
  kind: 'reducer',
  key: undefined,
  filter: { kind: 'filter', event: source, where: {} },
  aggregation,
})

export function count<E extends EventDef>(
  source: E,
): UnnamedReducer<E, { func: 'count' }> {
  return reducer(source, { func: 'count' })
}

export function sum<E extends EventDef, P extends NumericKeys<MetadataOf<E>>>(
  source: E,
  property: P,
): UnnamedReducer<E, { func: 'sum'; property: P }> {
  return reducer(source, { func: 'sum', property })
}

export interface Price {
  /** Price per unit, in major currency units. */
  readonly amount: number
  readonly currency?: string
}

export interface Money extends Price {
  readonly currency: string
}

export const usd = (amount: number): Money => {
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error(`usd: amount must be a non-negative number, got ${amount}`)
  return { amount, currency: 'usd' }
}

export interface MeterDef<
  Key extends string = string,
  R extends ReducerDef = ReducerDef,
> {
  readonly kind: 'meter'
  readonly key: Key
  readonly reducer: R
  readonly price: Price
}

export function meter<
  Key extends string,
  E extends EventDef,
  A extends Aggregation,
>(
  key: Key,
  options: { reducer: UnnamedReducer<E, A>; price: Price },
): MeterDef<Key, ReducerDef<Key, E, A>> {
  if (key === '') throw new Error('meter: empty key')
  if (options.price.amount < 0) throw new Error(`meter ${key}: negative price`)
  return {
    kind: 'meter',
    key,
    reducer: { ...options.reducer, key },
    price: options.price,
  }
}

export type SchemaModule = Record<string, MeterDef>

export interface Config<M extends SchemaModule = SchemaModule> {
  readonly kind: 'config'
  readonly schema: M
  readonly meters: readonly MeterDef[]
}

const isMeter = (value: unknown): value is MeterDef =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'meter'

export const defineConfig = <M extends SchemaModule>({
  schema,
}: {
  readonly schema: M
}): Config<M> => {
  const seen = new Map<string, MeterDef>()
  for (const [exportName, value] of Object.entries(schema)) {
    if (!isMeter(value)) throw new Error(`${exportName} is not a meter`)
    const prior = seen.get(value.key)
    if (prior !== undefined && prior !== value)
      throw new Error(`meter ${value.key} is defined twice`)
    seen.set(value.key, value)
  }
  return { kind: 'config', schema, meters: [...seen.values()] }
}
