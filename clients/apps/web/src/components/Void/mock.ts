import { ParsedMetricsResponse } from '@/hooks/queries'
import { subDays } from 'date-fns'
import {
  CHILD_NAMES,
  EVENT_NAMES,
  METERS,
  NOTES,
  PLANS,
  REDUCERS,
  ROOTS,
} from './fixtures'
import {
  cadenceFor,
  dailySeriesFor,
  metersFor,
  usageSeriesFor,
} from './generators'
import { VoidReducerMetric } from './identityLive'
import { overviewResponse, VoidOverviewPoint } from './overview'
import {
  VoidActivityMix,
  VoidActivityShare,
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

const activeOn = (identity: VoidIdentity, day: number) =>
  (identity.cadence[day] ?? 0) > 0 ||
  Object.values(identity.usageSeries).some((series) => (series[day] ?? 0) > 0)

const buildOverview = (
  end: Date,
  random: () => number,
  scale: number,
  identities: VoidIdentity[],
  subscriptions: VoidSubscription[],
): ParsedMetricsResponse => {
  const days = Array.from({ length: DAYS }, (_, index) =>
    startOfUtcDay(subDays(end, DAYS - 1 - index)),
  )
  const billedTotal = METERS.reduce((sum, meter) => sum + meter.billed, 0)
  const billed = dailySeriesFor(Math.round(billedTotal * scale), random)
  const finalSubscriptions = PLANS.reduce((sum, plan) => sum + plan.active, 0)
  const finalMrr = PLANS.reduce((sum, plan) => sum + plan.mrr, 0)
  const growth = (day: number) =>
    scale * (0.9 + (0.1 * day) / (DAYS - 1)) - (random() > 0.8 ? 0.01 : 0)
  const points: VoidOverviewPoint[] = days.map((timestamp, day) => {
    const factor = growth(day)
    const isCurrent = scale === 1
    return {
      timestamp,
      billed: billed[day],
      activeIdentities: isCurrent
        ? identities.filter((identity) => activeOn(identity, day)).length
        : Math.round(12 * scale + random() * 6),
      mrr: Math.round(finalMrr * factor),
      activeSubscriptions: Math.round(finalSubscriptions * factor),
      newSubscriptions: isCurrent
        ? subscriptions.filter(
            (subscription) =>
              startOfUtcDay(new Date(subscription.started_at)).getTime() ===
              timestamp.getTime(),
          ).length
        : random() > 0.75
          ? 1
          : 0,
    }
  })
  const distinct =
    scale === 1
      ? identities.filter((identity) =>
          days.some((_, day) => activeOn(identity, day)),
        ).length
      : Math.round(18 * scale)
  return overviewResponse(points, distinct)
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

const ACTIVITY_WEIGHTS: [string, number][] = [
  ['implement', 0.42],
  ['retrieve', 0.22],
  ['plan', 0.14],
  ['act', 0.08],
  ['review', 0.07],
  ['retry', 0.05],
  ['other', 0.02],
]

const buildActivities = (
  identities: VoidIdentity[],
): Record<string, VoidActivityMix> =>
  Object.fromEntries(
    identities
      .filter((identity) => identity.usage > 0)
      .map((identity) => {
        const shares: VoidActivityShare[] = ACTIVITY_WEIGHTS.map(
          ([slug, weight], index) => {
            const cost = Math.round(identity.usage * weight)
            return {
              slug,
              cost,
              share: weight,
              spans: 2 + ((identity.id.length + index) % 7),
              waste_cost: slug === 'retry' ? cost : Math.round(cost * 0.08),
            }
          },
        )
        const cost = shares.reduce((sum, share) => sum + share.cost, 0)
        const mix: VoidActivityMix = {
          totals: {
            cost,
            labeled_cost: cost,
            unlabeled_cost: 0,
            pending_cost: 0,
          },
          by_activity: shares,
        }
        return [identity.id, mix]
      }),
  )

export const getVoidData = (): VoidData => {
  const end = new Date()
  const random = seeded(20260910)
  const identities = buildIdentities(end, random)
  const subscriptions = buildSubscriptions(identities, end)
  const metrics = buildOverview(end, random, 1, identities, subscriptions)
  const previousMetrics = buildOverview(
    subDays(end, DAYS),
    random,
    0.86,
    identities,
    subscriptions,
  )
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
        status: 'Archived',
      },
      {
        version: 'v12',
        hash: 'd04c3f6',
        time: subDays(end, 23).toISOString(),
        status: 'Archived',
      },
    ],
    events,
    eventCount: 2_418_306,
    subscriptions,
    entitlements: buildEntitlements(subscriptions),
    activities: buildActivities(identities),
  }
}

export const getVoidReducerMetrics = (): VoidReducerMetric[] => {
  const end = new Date()
  const random = seeded(20260910)
  return REDUCERS.map((reducer, index) => {
    const values = dailySeriesFor(reducer.total, random)
    return {
      id: `reducer_${index + 1}`,
      slug: reducer.slug,
      total: values.reduce((sum, value) => sum + value, 0),
      periods: values.map((value, day) => ({
        timestamp: startOfUtcDay(subDays(end, DAYS - 1 - day)).toISOString(),
        value,
      })),
    }
  })
}
