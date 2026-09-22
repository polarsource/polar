import type { IrClause, IrReducer } from '@void/sdk/config'

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [k: string]: Json }
export type Metadata = Record<string, Json>

export interface StreamEvent {
  readonly id: string
  readonly name: string
  readonly metadata: Metadata
}

/**
 * A browser-side interpreter for compiled reducers, so a scene can fold a
 * stream of events with the definitions the reader just wrote. It follows the
 * server's rules for filters, maps and formulas: non-numeric values do not
 * sum, missing references and division by zero produce null.
 */

const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const like = (value: unknown, pattern: unknown) => {
  if (typeof value !== 'string' || typeof pattern !== 'string') return false
  const source = pattern
    .split(/(%|_)/)
    .map((part) =>
      part === '%'
        ? '.*'
        : part === '_'
          ? '.'
          : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('')
  return new RegExp(`^${source}$`).test(value)
}

export const matchesClause = (event: StreamEvent, clause: IrClause) => {
  const actual: Json =
    clause.property === 'name'
      ? event.name
      : (event.metadata[clause.property] ?? null)
  const expected = clause.value
  switch (clause.operator) {
    case 'eq':
      return actual === expected
    case 'ne':
      return actual !== expected
    case 'gt':
      return (
        number(actual) !== null && (actual as number) > (expected as number)
      )
    case 'gte':
      return (
        number(actual) !== null && (actual as number) >= (expected as number)
      )
    case 'lt':
      return (
        number(actual) !== null && (actual as number) < (expected as number)
      )
    case 'lte':
      return (
        number(actual) !== null && (actual as number) <= (expected as number)
      )
    case 'like':
      return like(actual, expected)
    case 'not_like':
      return !like(actual, expected)
  }
}

export const matches = (event: StreamEvent, reducer: IrReducer) =>
  reducer.filter === undefined ||
  (reducer.filter.conjunction === 'and'
    ? reducer.filter.clauses.every((clause) => matchesClause(event, clause))
    : reducer.filter.clauses.some((clause) => matchesClause(event, clause)))

/** `$a * 2 + $b`, evaluated over `scope`, without ever touching JavaScript's evaluator. */
export const evaluate = (
  expression: string,
  scope: Record<string, Json | undefined>,
): number | null => {
  const tokens =
    expression.match(
      /\$[A-Za-z_][A-Za-z0-9_]*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+*/-]|\S/g,
    ) ?? []
  let index = 0
  const atom = (): number | null => {
    const token = tokens[index++]
    if (token === '-') {
      const value = atom()
      return value === null ? null : -value
    }
    if (token === '+') return atom()
    if (token === '(') {
      const value = add()
      index++
      return value
    }
    if (token?.startsWith('$')) return number(scope[token.slice(1)])
    return token === undefined ? null : number(Number(token))
  }
  const multiply = (): number | null => {
    let value = atom()
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index++]
      const right = atom()
      if (value === null || right === null) value = null
      else if (operator === '*') value = value * right
      else value = right === 0 ? null : value / right
    }
    return value === null ? null : number(value)
  }
  const add = (): number | null => {
    let value = multiply()
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index++]
      const right = multiply()
      if (value === null || right === null) value = null
      else value = operator === '+' ? value + right : value - right
    }
    return value === null ? null : number(value)
  }
  return add()
}

/** The metadata an aggregation reads: the event's own, or the map's projection of it. */
export const project = (reducer: IrReducer, metadata: Metadata): Metadata => {
  if (reducer.map === undefined) return metadata
  return Object.fromEntries(
    Object.entries(reducer.map).map(([key, value]) => [
      key,
      typeof value === 'string' && value.includes('$')
        ? evaluate(value, metadata)
        : (value as Json),
    ]),
  )
}

export interface Folded {
  readonly slug: string
  /** Events that passed the filter, in order. */
  readonly matched: readonly string[]
  readonly value: number | null
  /** For `first` and `last`: the projected record. */
  readonly record: Metadata | null
}

const scalar = (
  reducer: IrReducer,
  rows: readonly Metadata[],
): { value: number | null; record: Metadata | null } => {
  const agg = reducer.aggregation
  if (agg.func === 'derive') return { value: null, record: null }
  if (agg.func === 'count') return { value: rows.length, record: null }
  if (agg.func === 'first') return { value: null, record: rows[0] ?? null }
  if (agg.func === 'last') return { value: null, record: rows.at(-1) ?? null }
  const property = 'property' in agg ? agg.property : undefined
  const numbers = rows
    .map((row) => (property === undefined ? null : number(row[property])))
    .filter((value): value is number => value !== null)
  if (agg.func === 'sum')
    return { value: numbers.reduce((total, n) => total + n, 0), record: null }
  if (numbers.length === 0) return { value: null, record: null }
  return {
    value: agg.func === 'min' ? Math.min(...numbers) : Math.max(...numbers),
    record: null,
  }
}

/** Folds the stream through every reducer; derived reducers read the others' values. */
export const fold = (
  reducers: readonly IrReducer[],
  events: readonly StreamEvent[],
): Folded[] => {
  const direct = reducers
    .filter((reducer) => reducer.aggregation.func !== 'derive')
    .map((reducer): Folded => {
      const hits = events.filter((event) => matches(event, reducer))
      const rows = hits.map((event) => project(reducer, event.metadata))
      return {
        slug: reducer.slug,
        matched: hits.map((e) => e.id),
        ...scalar(reducer, rows),
      }
    })
  const bySlug = new Map(direct.map((folded) => [folded.slug, folded.value]))
  const derived = reducers
    .filter((reducer) => reducer.aggregation.func === 'derive')
    .map((reducer): Folded => {
      const agg = reducer.aggregation as {
        func: 'derive'
        expression: string
        inputs: Record<string, string>
      }
      const scope = Object.fromEntries(
        Object.entries(agg.inputs).map(([name, slug]) => [
          name,
          bySlug.get(slug) ?? null,
        ]),
      )
      return {
        slug: reducer.slug,
        matched: [],
        value: evaluate(agg.expression, scope),
        record: null,
      }
    })
  return reducers.map(
    (reducer) =>
      [...direct, ...derived].find((folded) => folded.slug === reducer.slug)!,
  )
}
