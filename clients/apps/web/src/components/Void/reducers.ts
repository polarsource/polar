import { formatHumanFriendlyScalar } from '@/utils/formatters'
import { VoidReducerMetric, VoidReducerRecord } from './identityLive'

export type ReducerFunc =
  | 'count'
  | 'sum'
  | 'max'
  | 'min'
  | 'first'
  | 'last'
  | 'derive'

export interface ReducerFilterClause {
  property: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'not_like'
  value: string | number | boolean
}

export interface ReducerFilter {
  conjunction: 'and' | 'or'
  clauses: (ReducerFilterClause | ReducerFilter)[]
}

export interface VoidReducerAggregation {
  func: ReducerFunc
  property?: string
  expression?: string
  inputs?: Record<string, string>
}

export interface VoidReducerDefinition extends VoidReducerRecord {
  filter: ReducerFilter | null
  aggregation: VoidReducerAggregation
  map?: Record<string, unknown> | null
  created_at: string
}

export interface VoidMeterDefinition {
  id: string
  name: string
  slug: string
  usage_reducer_id: string
  credit_reducer_id: string
  unit_amount: string
  currency: string
}

export interface VoidReducerSeries {
  total: number | null
  allTime: number | null
  periods: { timestamp: string; value: number | null }[]
}

export type MeterRole = 'usage' | 'credits'

export interface MeterUsage {
  meter: VoidMeterDefinition
  role: MeterRole
}

export function isClause(
  entry: ReducerFilterClause | ReducerFilter,
): entry is ReducerFilterClause {
  return 'property' in entry
}

export function describeAggregation(
  aggregation: VoidReducerAggregation,
): string {
  switch (aggregation.func) {
    case 'count':
      return 'count of events'
    case 'derive':
      return aggregation.expression ?? 'derived'
    case 'first':
    case 'last':
      return `${aggregation.func} record`
    default:
      break
  }
  if (aggregation.property) {
    return `${aggregation.func} of ${aggregation.property}`
  }
  return aggregation.func
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function metersUsing(
  meters: VoidMeterDefinition[],
  reducerId: string,
): MeterUsage[] {
  const used: MeterUsage[] = []
  for (const meter of meters) {
    if (meter.usage_reducer_id === reducerId) {
      used.push({ meter, role: 'usage' })
    }
    if (meter.credit_reducer_id === reducerId) {
      used.push({ meter, role: 'credits' })
    }
  }
  return used
}

export function meterRoleLabel(role: MeterRole): string {
  if (role === 'usage') return 'counts usage'
  return 'grants credits'
}

export function usedByMetersLabel(count: number): string {
  if (count === 0) return 'not used by any meter'
  if (count === 1) return 'used by 1 meter'
  return `used by ${count} meters`
}

export function reducerHref(base: string, id: string): string {
  return `${base}/definition/reducers/${id}`
}

export function dayLabel(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatReducerTotal(value: number | null | undefined): string {
  if (value == null) return '—'
  return formatHumanFriendlyScalar(value)
}

export function seriesFromMetrics(
  id: string,
  type: 'scalar' | 'dict' | undefined,
  metrics: VoidReducerMetric[],
): VoidReducerSeries | undefined {
  if (type !== 'scalar') return undefined
  const metric = metrics.find((entry) => entry.id === id)
  if (!metric) return undefined
  return {
    total: metric.total,
    allTime: metric.total,
    periods: metric.periods,
  }
}
