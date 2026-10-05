import type { Config, Schema } from './config'
import type {
  Filter,
  FilterClause,
  FilterOperator,
  FilterValue,
} from './filter'
import type { MeterDef, MeterUnit } from './meter'
import type { Currency } from './money'
import type { Aggregation } from './usage'

/** The JSON a deployment sends: snake_case fields, every list sorted. */
export interface Ir {
  readonly events: readonly IrEvent[]
  readonly meters: readonly IrMeter[]
}

export interface IrEvent {
  readonly name: string
}

export interface IrClause {
  readonly property: string
  readonly operator: FilterOperator
  readonly value: FilterValue
}

export interface IrFilter {
  readonly conjunction: 'and' | 'or'
  readonly clauses: readonly (IrClause | IrFilter)[]
}

export interface IrMeter {
  readonly slug: string
  readonly name: string
  readonly filter: IrFilter
  readonly aggregation: Aggregation
  readonly unit: MeterUnit
  readonly custom_label?: string
  readonly custom_multiplier?: number
  /** Per unit, in the currency's minor unit, as a decimal string. */
  readonly unit_amount: string
  readonly currency: Currency
}

export function compile<S extends Schema>(config: Config<S>): Ir {
  return {
    events: eventNames(config).map((name) => ({ name })),
    meters: config.meters.map(compileMeter).sort(bySlug),
  }
}

/** Events in the schema, plus any a meter matches by name without exporting. */
function eventNames<S extends Schema>({ schema, meters }: Config<S>): string[] {
  const names = new Set<string>()
  for (const def of Object.values(schema)) {
    if (def.kind === 'event') names.add(def.name)
  }
  for (const meter of meters) {
    for (const name of matchedNames(meter.filter)) names.add(name)
  }
  return [...names].sort()
}

function matchedNames(filter: Filter): string[] {
  return filter.clauses.flatMap((clause) =>
    isFilter(clause)
      ? matchedNames(clause)
      : clause.property === 'name' &&
          clause.operator === 'eq' &&
          typeof clause.value === 'string'
        ? [clause.value]
        : [],
  )
}

function compileFilter(filter: Filter): IrFilter {
  return {
    conjunction: filter.conjunction,
    clauses: filter.clauses
      .map((clause) =>
        isFilter(clause)
          ? compileFilter(clause)
          : {
              property: clause.property,
              operator: clause.operator,
              value: clause.value,
            },
      )
      .sort(byClause),
  }
}

function compileMeter(meter: MeterDef): IrMeter {
  return {
    slug: meter.key,
    name: meter.name,
    filter: compileFilter(meter.filter),
    aggregation: { ...meter.aggregation },
    unit: meter.unit,
    ...(meter.unit === 'custom' && {
      custom_label: meter.customLabel,
      ...(meter.customMultiplier !== undefined && {
        custom_multiplier: meter.customMultiplier,
      }),
    }),
    unit_amount: meter.price.amount,
    currency: meter.price.currency,
  }
}

const isFilter = (clause: FilterClause | Filter): clause is Filter =>
  'conjunction' in clause

function byClause(
  left: IrClause | IrFilter,
  right: IrClause | IrFilter,
): number {
  if ('conjunction' in left && 'conjunction' in right) {
    return (
      compareCodeUnits(left.conjunction, right.conjunction) ||
      compareClauses(left.clauses, right.clauses)
    )
  }
  if ('conjunction' in left) return 1
  if ('conjunction' in right) return -1
  return (
    compareCodeUnits(left.property, right.property) ||
    compareCodeUnits(left.operator, right.operator) ||
    compareValues(left.value, right.value)
  )
}

function compareClauses(
  left: readonly (IrClause | IrFilter)[],
  right: readonly (IrClause | IrFilter)[],
): number {
  const shared = Math.min(left.length, right.length)
  for (let index = 0; index < shared; index++) {
    const leftClause = left[index]
    const rightClause = right[index]
    if (leftClause === undefined || rightClause === undefined) break
    const order = byClause(leftClause, rightClause)
    if (order !== 0) return order
  }
  return left.length - right.length
}

function compareValues(left: FilterValue, right: FilterValue): number {
  if (typeof left === 'string' && typeof right === 'string') {
    return compareCodeUnits(left, right)
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left < right ? -1 : left > right ? 1 : 0
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }
  return valueRank(left) - valueRank(right)
}

function valueRank(value: FilterValue): number {
  if (typeof value === 'boolean') return 0
  if (typeof value === 'number') return 1
  return 2
}

// Code-unit order, not localeCompare, so the output is the same on every machine.
function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

const bySlug = <T extends { readonly slug: string }>(left: T, right: T) =>
  compareCodeUnits(left.slug, right.slug)
