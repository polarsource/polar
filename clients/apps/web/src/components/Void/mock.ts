import { ParsedMetricPeriod, ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { subDays } from 'date-fns'
import {
  CHILD_NAMES,
  EVENT_NAMES,
  METERS,
  NOTES,
  PLANS,
  ROOTS,
} from './fixtures'
import { cadenceFor, metersFor, usageSeriesFor } from './generators'
import {
  VoidData,
  VoidEntitlement,
  VoidEvent,
  VoidIdentity,
  VoidIdentityKind,
  VoidSubscription,
} from './types'

const DAYS = 30

const seeded = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

const startOfUtcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )

const METRICS: schemas['Metrics'] = {
  revenue: { slug: 'revenue', display_name: 'Revenue', type: 'currency' },
  orders: { slug: 'orders', display_name: 'Orders', type: 'scalar' },
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
  churn_rate: {
    slug: 'churn_rate',
    display_name: 'Churn Rate',
    type: 'percentage',
  },
}

const buildMetrics = (
  end: Date,
  random: () => number,
  scale: number,
): ParsedMetricsResponse => {
  let active = Math.round(118 * scale)
  const periods = Array.from({ length: DAYS }, (_, index) => {
    const timestamp = startOfUtcDay(subDays(end, DAYS - 1 - index))
    const weekend = [0, 6].includes(timestamp.getUTCDay())
    const orders = Math.round((weekend ? 9 : 17) * scale + random() * 8)
    const revenue = Math.round(orders * (5_800 + random() * 3_200))
    active += Math.round(random() * 3) - (random() > 0.7 ? 1 : 0)
    return {
      timestamp,
      revenue,
      orders,
      monthly_recurring_revenue: active * 4_900,
      active_subscriptions: active,
      churn_rate: Number((0.008 + random() * 0.012).toFixed(4)),
    }
  })
  const sum = (key: 'revenue' | 'orders') =>
    periods.reduce((total, period) => total + period[key], 0)
  const last = periods[periods.length - 1]
  return {
    periods: periods as unknown as ParsedMetricPeriod[],
    totals: {
      revenue: sum('revenue'),
      orders: sum('orders'),
      monthly_recurring_revenue: last.monthly_recurring_revenue,
      active_subscriptions: last.active_subscriptions,
      churn_rate: Number(
        (
          periods.reduce((total, period) => total + period.churn_rate, 0) / DAYS
        ).toFixed(4),
      ),
    },
    metrics: METRICS,
  }
}

const buildIdentities = (end: Date, random: () => number): VoidIdentity[] =>
  ROOTS.flatMap(([name, kind, spend], index) => {
    const id = `ident_${index + 1}`
    const createdDaysAgo =
      index < 4 ? 40 + index * 30 : Math.round(random() * 28)
    const childCount = index < 6 ? 1 + (index % 3) : 0
    const usage = Math.round((spend * 0.92) / 100) * 100
    const ownShare = childCount > 0 ? 0.35 : 1
    const root: VoidIdentity = {
      id,
      parent_id: null,
      name,
      kind,
      created_at: subDays(end, createdDaysAgo).toISOString(),
      note: NOTES[id] ?? null,
      spend,
      orders: spend > 0 ? Math.max(1, Math.round(spend / 24_000)) : 0,
      usage: Math.round((usage * ownShare) / 100) * 100,
      cadence: cadenceFor(spend, random),
      meters: metersFor(Math.round((usage * ownShare) / 100) * 100, random),
      usageSeries: usageSeriesFor(
        Math.round((usage * ownShare) / 100) * 100,
        random,
      ),
      credits: spend > 0 ? Math.ceil(usage / 0.46 / 100_000) * 100_000 : null,
    }
    const childUsage =
      Math.round((usage * (1 - ownShare)) / (childCount || 1) / 100) * 100
    const children = Array.from({ length: childCount }, (_, childIndex) => {
      const childId = `${id}_${childIndex + 1}`
      return {
        id: childId,
        parent_id: id,
        name: CHILD_NAMES[(index + childIndex) % CHILD_NAMES.length],
        kind: (childIndex === 0 ? 'agent' : 'service') as VoidIdentityKind,
        created_at: subDays(end, Math.max(createdDaysAgo - 2, 0)).toISOString(),
        note: NOTES[childId] ?? null,
        spend: 0,
        orders: 0,
        usage: childUsage,
        cadence: [],
        meters: metersFor(childUsage, random),
        usageSeries: usageSeriesFor(childUsage, random),
        credits: null,
      }
    })
    return [root, ...children]
  })

const buildSubscriptions = (
  identities: VoidIdentity[],
  end: Date,
): VoidSubscription[] =>
  identities
    .filter((identity) => identity.parent_id === null && identity.spend > 0)
    .map((identity, index) => {
      const canceled = index === 3
      return {
        id: `sub_${index + 1}`,
        identity_id: identity.id,
        product: PLANS[index % PLANS.length].name,
        status: canceled ? 'canceled' : index === 6 ? 'trialing' : 'active',
        started_at: identity.created_at,
        current_period_end: subDays(end, -(12 + index)).toISOString(),
        ends_at: canceled ? subDays(end, -12 - index).toISOString() : null,
      }
    })

const buildEntitlements = (
  subscriptions: VoidSubscription[],
): VoidEntitlement[] =>
  subscriptions.flatMap((subscription) => [
    {
      slug: 'api-access',
      name: 'API access',
      product: subscription.product,
      subscription_id: subscription.id,
      identity_id: subscription.identity_id,
    },
    ...(subscription.product === 'Scale'
      ? [
          {
            slug: 'priority-lane',
            name: 'Priority inference lane',
            product: subscription.product,
            subscription_id: subscription.id,
            identity_id: subscription.identity_id,
          },
        ]
      : []),
  ])

export const getVoidData = (): VoidData => {
  const end = new Date()
  const random = seeded(20260910)
  const metrics = buildMetrics(end, random, 1)
  const previousMetrics = buildMetrics(subDays(end, DAYS), random, 0.86)
  const identities = buildIdentities(end, random)
  const subscriptions = buildSubscriptions(identities, end)
  const events: VoidEvent[] = EVENT_NAMES.map(([name, source], index) => ({
    id: `evt_${index + 1}`,
    name,
    source,
    identity_id: identities[(index * 3) % identities.length].id,
    timestamp: new Date(
      end.getTime() - (index + 1) * 11 * 60_000,
    ).toISOString(),
  }))
  return {
    metrics,
    previousMetrics,
    identities,
    meters: METERS,
    plans: PLANS,
    deployments: [
      {
        version: 'v14',
        hash: '8c1f2a9',
        time: subDays(end, 2).toISOString(),
        status: 'Active',
      },
      {
        version: 'v13',
        hash: '5b77e10',
        time: subDays(end, 9).toISOString(),
        status: 'Superseded',
      },
      {
        version: 'v12',
        hash: 'd04c3f6',
        time: subDays(end, 23).toISOString(),
        status: 'Superseded',
      },
    ],
    events,
    eventCount: 2_418_306,
    subscriptions,
    entitlements: buildEntitlements(subscriptions),
  }
}
