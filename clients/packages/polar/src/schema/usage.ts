import { SchemaError } from './error'
import { on } from './event'
import type {
  EventDef,
  EventFilter,
  EventMetadata,
  MetadataKeys,
  NumericKeys,
} from './event'
import { toFilter } from './filter'
import type { Filter, FilterClause } from './filter'

export interface CountAggregation {
  readonly func: 'count'
}

export interface PropertyAggregation {
  readonly func: 'sum' | 'max' | 'min' | 'avg'
  readonly property: string
}

export interface UniqueAggregation {
  readonly func: 'unique'
  readonly property: string
}

export type Aggregation =
  | CountAggregation
  | PropertyAggregation
  | UniqueAggregation

/** The events usage is computed from: an event, `on(event, where)`, or a raw filter. */
export type UsageSource<M extends EventMetadata = EventMetadata> =
  | EventDef<M>
  | EventFilter<M>
  | FilterClause

/** What a meter bills: the events it matches and how they add up. */
export interface Usage {
  readonly filter: Filter
  readonly aggregation: Aggregation
}

export function count(source: UsageSource): Usage {
  return usage(source, { func: 'count' })
}

function numeric(func: PropertyAggregation['func']) {
  return <M extends EventMetadata = EventMetadata>(
    source: UsageSource<M>,
    property: NumericKeys<M>,
  ): Usage => usage(source, { func, property: fieldName(property) })
}

export const sum = numeric('sum')
export const max = numeric('max')
export const min = numeric('min')
export const avg = numeric('avg')

export function unique<M extends EventMetadata = EventMetadata>(
  source: UsageSource<M>,
  property: MetadataKeys<M>,
): Usage {
  return usage(source, { func: 'unique', property: fieldName(property) })
}

function usage(source: UsageSource, aggregation: Aggregation): Usage {
  return {
    filter: 'kind' in source ? on(source) : toFilter(source),
    aggregation,
  }
}

function fieldName(property: string): string {
  if (property === '') throw new SchemaError('usage', 'property is empty')
  return property
}
