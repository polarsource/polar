import { createHash } from 'node:crypto'
import type { Config } from './config'
import {
  DEFAULT_CURRENCY,
  type Aggregation,
  type BillingInterval,
  type Comparison,
  type EntitlementDef,
  type EventDef,
  type Filter,
  type Limit,
  type Metadata,
  type ProductDef,
  type AnyReducer,
  type ActivityDef,
} from './schema'

/**
 * The canonical form `deploy` sends and hashes. Field names follow the
 * server's request bodies so the CLI can post entries as they are.
 */
export interface IrClause {
  property: string
  operator: Comparison['op']
  value: string | number | boolean
}
export interface IrFilter {
  conjunction: 'and' | 'or'
  clauses: IrClause[]
}
export interface IrEvent {
  name: string
}
export interface IrReducer {
  slug: string
  filter?: IrFilter
  aggregation:
    | Aggregation
    | { func: 'derive'; expression: string; inputs: Record<string, string> }
  map?: Metadata
}
export interface IrMeter {
  slug: string
  reducer: string
  credit_reducer?: string
  unit_amount: number
  currency: string
}
export interface IrEntitlement {
  slug: string
  name?: string
  description?: string
}
export type IrPrice =
  | {
      type: 'recurring'
      interval: BillingInterval
      interval_count: number
      amount: number
      currency: string
    }
  | { type: 'one_time'; amount: number; currency: string }
export interface IrProductMeter {
  slug: string
  /** Credits granted at the start of every period. */
  included: number
  limit: Limit
  /** Unused credit carried into the next period; null carries all of it. */
  rollover_cap: number | null
}
export interface IrProduct {
  slug: string
  name: string
  description?: string
  price: IrPrice
  /** The product's terms per meter, sorted by slug. */
  meters: IrProductMeter[]
  /** Entitlement slugs, sorted. */
  entitlements: string[]
}
export interface IrActivity {
  slug: string
  event: string
  group_by: string
  run_by?: string
  taxonomy: string
}
export interface Ir {
  version: 4
  events: IrEvent[]
  reducers: IrReducer[]
  meters: IrMeter[]
  entitlements: IrEntitlement[]
  products: IrProduct[]
  activities?: IrActivity[]
}

const isComparison = (value: unknown): value is Comparison =>
  typeof value === 'object' && value !== null && 'op' in value
// Array.isArray alone leaves readonly arrays in the other branch.
const isComparisons = (value: unknown): value is readonly Comparison[] =>
  Array.isArray(value)

const clause = (
  property: string,
  value:
    | string
    | number
    | boolean
    | Comparison
    | readonly Comparison[]
    | undefined,
): IrClause[] =>
  value === undefined
    ? []
    : isComparisons(value)
      ? value.flatMap((comparison) => clause(property, comparison))
      : isComparison(value)
        ? [{ property, operator: value.op, value: value.value }]
        : [{ property, operator: 'eq', value }]

const compileFilter = (filter: Filter): IrFilter => ({
  conjunction: 'and',
  clauses: [
    { property: 'name', operator: 'eq', value: filter.event.name },
    ...Object.entries(filter.where)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([property, value]) => clause(property, value)),
  ],
})

const compileEvent = (event: EventDef): IrEvent => ({
  name: event.name,
})

const compileReducer = (reducer: AnyReducer): IrReducer =>
  'inputs' in reducer
    ? {
        slug: reducer.key,
        aggregation: {
          ...reducer.aggregation,
          inputs: Object.fromEntries(
            Object.entries(reducer.inputs)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, source]) => [name, source.key]),
          ),
        },
      }
    : {
        slug: reducer.key,
        filter: compileFilter(reducer.filter),
        aggregation: reducer.aggregation,
        ...(reducer.map !== undefined && { map: reducer.map }),
      }

const compileEntitlement = (entitlement: EntitlementDef): IrEntitlement => ({
  slug: entitlement.key,
  ...(entitlement.name !== undefined && { name: entitlement.name }),
  ...(entitlement.description !== undefined && {
    description: entitlement.description,
  }),
})

const compilePrice = (price: ProductDef['price']): IrPrice =>
  price.type === 'recurring'
    ? {
        type: 'recurring',
        interval: price.interval,
        interval_count: price.intervalCount,
        amount: price.amount.amount,
        currency: price.amount.currency,
      }
    : {
        type: 'one_time',
        amount: price.amount.amount,
        currency: price.amount.currency,
      }

const compileProduct = (product: ProductDef): IrProduct => ({
  slug: product.key,
  name: product.name,
  ...(product.description !== undefined && {
    description: product.description,
  }),
  price: compilePrice(product.price),
  meters: product.meters
    .map((term) => ({
      slug: term.meter.key,
      included: term.included,
      limit: term.limit,
      rollover_cap: term.rolloverCap,
    }))
    .sort(bySlug),
  entitlements: product.entitlements.map((e) => e.key).sort(),
})

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name)
const bySlug = <T extends { slug: string }>(a: T, b: T) =>
  a.slug.localeCompare(b.slug)

const compileActivity = (activity: ActivityDef): IrActivity => ({
  slug: activity.key,
  event: activity.event.name,
  group_by: activity.span,
  ...(activity.run !== undefined && { run_by: activity.run }),
  taxonomy: activity.taxonomy,
})

export const compile = (config: Config): Ir => {
  return {
    version: 4,
    events: config.events.map(compileEvent).sort(byName),
    reducers: config.reducers.map(compileReducer).sort(bySlug),
    meters: config.meters
      .map((meter) => ({
        slug: meter.key,
        reducer: meter.reducer.key,
        ...(meter.creditReducer && { credit_reducer: meter.creditReducer.key }),
        unit_amount: meter.price.amount,
        currency: meter.price.currency ?? DEFAULT_CURRENCY,
      }))
      .sort(bySlug),
    entitlements: config.entitlements.map(compileEntitlement).sort(bySlug),
    products: config.products.map(compileProduct).sort(bySlug),
    ...(config.activities.length
      ? { activities: config.activities.map(compileActivity).sort(bySlug) }
      : {}),
  }
}

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v: unknown) =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  )

export const checksum = (ir: Ir): string =>
  createHash('sha256').update(canonical(ir)).digest('hex')

/** The IR's checksum for a config, which the runtime sends on every request. */
export const checksumOf = (config: Config): string => checksum(compile(config))
