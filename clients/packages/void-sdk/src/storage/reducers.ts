import type { Filter_Output, Reducer } from '../api/generated'
import { mapMetadata } from '../config/map'
import type { StoredEvent } from './storage'

/** The same string/numeric comparisons used by the server's reducer_buckets pipe. */
export function matches(
  filter: Filter_Output | null | undefined,
  event: StoredEvent,
  root: string | null,
): boolean {
  if (!filter)
    throw new Error('Event reconciliation requires an event reducer filter')
  const matched = filter.clauses.map((clause): boolean => {
    if ('clauses' in clause) return matches(clause, event, root)
    const key = clause.property.replace(/^metadata\./, '')
    const value =
      key === 'name'
        ? event.name
        : key === 'source'
          ? 'user'
          : key === 'external_identity_id'
            ? (event.external_identity_id ?? '')
            : key === 'external_root_id'
              ? (root ?? '')
              : event.metadata[key]
    const actual =
      typeof value === 'string'
        ? value
        : value === undefined
          ? ''
          : JSON.stringify(value)
    const wanted = String(clause.value)
    switch (clause.operator) {
      case 'eq':
        return actual === wanted
      case 'ne':
        return actual !== wanted
      case 'like':
        return actual.toLowerCase().includes(wanted.toLowerCase())
      case 'not_like':
        return !actual.toLowerCase().includes(wanted.toLowerCase())
      default: {
        const number = (text: string) =>
          text.trim() === '' ? NaN : Number(text)
        const a = number(actual),
          b = number(wanted)
        if (!Number.isFinite(a) || !Number.isFinite(b)) return false
        switch (clause.operator) {
          case 'gt':
            return a > b
          case 'gte':
            return a >= b
          case 'lt':
            return a < b
          case 'lte':
            return a <= b
        }
      }
    }
  })
  return filter.conjunction === 'and'
    ? matched.every(Boolean)
    : matched.some(Boolean)
}

export function contribution(
  reducer: Reducer,
  event: StoredEvent,
): number | null {
  if (reducer.aggregation.func === 'count') return 1
  if (!('property' in reducer.aggregation)) return null
  // JSONExtractRaw string values retain quotes and do not parse as numbers.
  const value = mapMetadata(reducer.map, event.metadata)[
    reducer.aggregation.property.replace(/^metadata\./, '')
  ]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function merge(
  func: Reducer['aggregation']['func'],
  values: readonly number[],
): number {
  if (func === 'max') return values.reduce((a, b) => Math.max(a, b), -Infinity)
  if (func === 'min') return values.reduce((a, b) => Math.min(a, b), Infinity)
  return values.reduce((sum, value) => sum + value, 0)
}
