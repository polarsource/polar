import { Predicate } from 'effect'
import type { RuntimeFilter, RuntimeMeterConfig } from '../schema/runtime'
import type { MeterFilterClause } from '../schema/meter'
import type { models } from '../sdk'

type IngestedEvent = {
  readonly name: string
  readonly timestamp: Date
  readonly metadata: models.EventMetadataInput
}

const eventProperty = (event: IngestedEvent, property: string): unknown => {
  const path = property.replace(/^metadata\./, '')
  if (path === 'name') return event.name
  if (path === 'source') return 'user'
  if (path === 'timestamp') return Math.floor(event.timestamp.getTime() / 1000)
  if (path === '') return undefined
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        Predicate.isObject(value) && Object.hasOwn(value, key)
          ? value[key]
          : undefined,
      event.metadata,
    )
}

const stringValue = (value: string | number | boolean): string =>
  typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value)

const matchesClause = (
  clause: MeterFilterClause,
  event: IngestedEvent,
): boolean => {
  const value = eventProperty(event, clause.property)
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  )
    return false
  const property = clause.property.replace(/^metadata\./, '')
  if (
    (property === 'name' || property === 'source') &&
    typeof clause.value !== 'string'
  )
    return false
  if (property === 'timestamp' && typeof clause.value === 'string') return false
  if (clause.operator === 'like' || clause.operator === 'not_like') {
    const contains = stringValue(value).includes(stringValue(clause.value))
    return clause.operator === 'like' ? contains : !contains
  }
  const actual = typeof value === 'boolean' ? Number(value) : value
  const expected =
    typeof clause.value === 'boolean' ? Number(clause.value) : clause.value
  if (typeof actual !== typeof expected) return clause.operator === 'ne'
  switch (clause.operator) {
    case 'eq':
      return actual === expected
    case 'ne':
      return actual !== expected
    case 'gt':
      return actual > expected
    case 'gte':
      return actual >= expected
    case 'lt':
      return actual < expected
    case 'lte':
      return actual <= expected
  }
}

const matchesFilter = (
  filter: RuntimeFilter,
  event: IngestedEvent,
): boolean => {
  if (filter.clauses.length === 0) return true
  const matches = (clause: RuntimeFilter['clauses'][number]) =>
    'conjunction' in clause
      ? matchesFilter(clause, event)
      : matchesClause(clause, event)
  return filter.conjunction === 'and'
    ? filter.clauses.every(matches)
    : filter.clauses.some(matches)
}

export const matchesMeter = (
  meter: RuntimeMeterConfig,
  event: IngestedEvent,
): boolean => {
  if (!matchesFilter(meter.filter, event)) return false
  if (meter.aggregation.func === 'count' || meter.aggregation.func === 'unique')
    return true
  const property = meter.aggregation.property.replace(/^metadata\./, '')
  if (['name', 'source', 'timestamp'].includes(property)) return true
  const value = eventProperty(event, meter.aggregation.property)
  return typeof value === 'number' || typeof value === 'boolean'
}
