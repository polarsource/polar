import { SchemaError } from './error'
import { and, eq, or } from './filter'
import type { Comparison, Filter, FilterClause, Widen } from './filter'

// Polar resolves these names to the event's own columns, never to metadata.
const EVENT_FIELDS = new Set(['name', 'source', 'timestamp'])

export type MetadataValue = string | number | boolean

export type EventMetadata = {
  readonly [key: string]: MetadataValue | undefined
}

export interface EventDef<M extends EventMetadata = EventMetadata> {
  readonly kind: 'event'
  readonly name: string
  /** Type-only metadata declaration; never set or validated at runtime. */
  readonly _metadata?: M
}

export type MetadataKeys<M extends EventMetadata> = string extends keyof M
  ? string
  : keyof M & string

export type NumericKeys<M extends EventMetadata> = string extends keyof M
  ? string
  : {
      [K in keyof M & string]-?: NonNullable<M[K]> extends number ? K : never
    }[keyof M & string]

export interface OneOf<V extends MetadataValue = MetadataValue> {
  readonly kind: 'oneOf'
  readonly values: readonly V[]
}

type MatcherValue<V extends MetadataValue> =
  | V
  | OneOf<V>
  | Comparison<Widen<V>>
  | readonly Comparison<Widen<V>>[]

/** One value, a set of values, or comparisons that must all hold, per metadata key. */
export type Matcher<M extends EventMetadata> = {
  readonly [K in MetadataKeys<M>]?: MatcherValue<NonNullable<M[K]>>
}

/** A filter matching one event, carrying its metadata type to the meter. */
export interface EventFilter<
  M extends EventMetadata = EventMetadata,
> extends Filter {
  readonly _metadata?: M
}

export function event<M extends EventMetadata = EventMetadata>(
  name: string,
): EventDef<M> {
  if (name === '') throw new SchemaError('event', 'name is empty')
  return { kind: 'event', name }
}

export function oneOf<const V extends MetadataValue>(
  ...values: readonly V[]
): OneOf<V> {
  if (values.length === 0) throw new SchemaError('oneOf', 'no values given')
  return { kind: 'oneOf', values }
}

/** `on(llmCompletion, { model: 'claude-opus-5-5' })`: the event plus metadata matchers. */
export function on<M extends EventMetadata>(
  event: EventDef<M>,
  where: Matcher<M> = {},
): EventFilter<M> {
  const matchers: [string, MatcherValue<MetadataValue> | undefined][] =
    Object.entries(where)
  return and(
    eq('name', event.name),
    ...matchers.flatMap(([property, matcher]) =>
      matcher === undefined ? [] : clauses(property, matcher),
    ),
  )
}

function clauses(
  property: string,
  matcher: MatcherValue<MetadataValue>,
): (FilterClause | Filter)[] {
  if (EVENT_FIELDS.has(property)) {
    throw new SchemaError(
      'on',
      `${property} is an event field, so it cannot be matched as metadata`,
    )
  }
  if (typeof matcher !== 'object') return [eq(property, matcher)]
  if (isComparisons(matcher)) {
    return matcher.map((comparison) => ({ property, ...comparison }))
  }
  if ('kind' in matcher) {
    return [or(...matcher.values.map((value) => eq(property, value)))]
  }
  return [{ property, ...matcher }]
}

const isComparisons = (
  matcher: MatcherValue<MetadataValue>,
): matcher is readonly Comparison[] => Array.isArray(matcher)
