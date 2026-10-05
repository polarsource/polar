import { SchemaError } from './error'

const MAX_STRING_LENGTH = 1000
const INT32_MIN = -2147483648
const INT32_MAX = 2147483647

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'not_like'

export type FilterValue = string | number | boolean

export type Widen<V extends FilterValue> = V extends string
  ? string
  : V extends number
    ? number
    : boolean

export interface Comparison<V extends FilterValue = FilterValue> {
  readonly operator: FilterOperator
  readonly value: V
}

export interface FilterClause extends Comparison {
  readonly property: string
}

export interface Filter {
  readonly conjunction: 'and' | 'or'
  readonly clauses: readonly (FilterClause | Filter)[]
}

/** `gt(5)` compares inside an event's `where`; `gt('tokens', 5)` is a raw clause. */
export interface Operator<V extends FilterValue> {
  <T extends V>(value: T): Comparison<Widen<T>>
  (property: string, value: V): FilterClause
}

function operator<V extends FilterValue>(op: FilterOperator): Operator<V> {
  function make(...args: [V] | [string, V]): Comparison | FilterClause {
    return args.length === 1
      ? { operator: op, value: checkValue(args[0]) }
      : {
          property: fieldName(args[0]),
          operator: op,
          value: checkValue(args[1]),
        }
  }
  return make as Operator<V>
}

export const eq = operator<FilterValue>('eq')
export const ne = operator<FilterValue>('ne')
export const gt = operator<number>('gt')
export const gte = operator<number>('gte')
export const lt = operator<number>('lt')
export const lte = operator<number>('lte')
export const like = operator<string>('like')
export const notLike = operator<string>('not_like')

export function and(...clauses: readonly (FilterClause | Filter)[]): Filter {
  return { conjunction: 'and', clauses }
}

export function or(...clauses: readonly (FilterClause | Filter)[]): Filter {
  return { conjunction: 'or', clauses }
}

export function toFilter(filter: FilterClause | Filter): Filter {
  return 'conjunction' in filter ? filter : and(filter)
}

function fieldName(property: string): string {
  if (property === '') throw new SchemaError('filter', 'property is empty')
  return property
}

function checkValue<V extends FilterValue>(value: V): V
function checkValue(value: FilterValue): FilterValue {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) {
      throw new SchemaError('filter', 'value is longer than 1000 characters')
    }
    return value
  }
  if (Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX) {
    return value
  }
  throw new SchemaError(
    'filter',
    `value must be a string, 32-bit integer, or boolean, got ${String(value)}`,
  )
}
