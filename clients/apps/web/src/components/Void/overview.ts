import { ParsedMetricPeriod, ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'

/**
 * The Home overview, in Void terms: metered usage as revenue, the
 * subscriptions that fund it, and the identities producing it. Rendered by the shared
 * Polar metric charts, so each series borrows a `Metrics` slug as its key.
 */
export type VoidOverviewKey =
  | 'revenue'
  | 'new_subscriptions'
  | 'monthly_recurring_revenue'
  | 'active_subscriptions'
  | 'active_user_by_event'

export const OVERVIEW_KEYS: VoidOverviewKey[] = [
  'revenue',
  'new_subscriptions',
  'monthly_recurring_revenue',
  'active_subscriptions',
  'active_user_by_event',
]

export const OVERVIEW_METRICS: schemas['Metrics'] = {
  revenue: { slug: 'revenue', display_name: 'Revenue', type: 'currency' },
  new_subscriptions: {
    slug: 'new_subscriptions',
    display_name: 'Subscriptions',
    type: 'scalar',
  },
  monthly_recurring_revenue: {
    slug: 'monthly_recurring_revenue',
    display_name: 'Monthly Recurring Revenue',
    type: 'currency',
  },
  active_subscriptions: {
    slug: 'active_subscriptions',
    display_name: 'Active Subscriptions',
    type: 'scalar',
  },
  active_user_by_event: {
    slug: 'active_user_by_event',
    display_name: 'Active Identities',
    type: 'scalar',
  },
}

export interface VoidOverviewPoint {
  timestamp: Date
  /** Metered usage priced at the active unit amounts, in cents. */
  billed: number
  /** Identities that consumed anything that day. */
  activeIdentities: number
  /** Monthly value of the subscriptions open that day, in cents. */
  mrr: number
  activeSubscriptions: number
  /** Subscriptions started that day. */
  newSubscriptions: number
}

export const overviewResponse = (
  points: VoidOverviewPoint[],
  distinctActiveIdentities: number,
): ParsedMetricsResponse => {
  const last = points.at(-1)
  const sum = (pick: (point: VoidOverviewPoint) => number) =>
    points.reduce((total, point) => total + pick(point), 0)
  return {
    metrics: OVERVIEW_METRICS,
    totals: {
      revenue: sum((point) => point.billed),
      new_subscriptions: sum((point) => point.newSubscriptions),
      monthly_recurring_revenue: last?.mrr ?? 0,
      active_subscriptions: last?.activeSubscriptions ?? 0,
      active_user_by_event: distinctActiveIdentities,
    },
    periods: points.map((point) => ({
      timestamp: point.timestamp,
      revenue: point.billed,
      new_subscriptions: point.newSubscriptions,
      monthly_recurring_revenue: point.mrr,
      active_subscriptions: point.activeSubscriptions,
      active_user_by_event: point.activeIdentities,
    })) as ParsedMetricPeriod[],
  }
}
