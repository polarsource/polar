import { useQuery } from '@tanstack/react-query'
import { addDays, subDays } from 'date-fns'
import { VoidDeploy, voidRequest, voidSearch } from './api'
import {
  VoidMeterRecord,
  VoidMetrics,
  VoidProductSubscriptionRecord,
} from './identityLive'
import { metersOfActive, startOfUtcDay } from './meters'
import { VoidOverviewPoint, overviewResponse } from './overview'
import { VoidProduct, monthlyCents } from './products'

const DAYS = 30

export const overviewKeys = {
  overview: (organizationId: string) => ['void_overview', organizationId],
}

interface OverviewInputs {
  days: Date[]
  meters: VoidMeterRecord[]
  usageByMeter: VoidMetrics[]
  subscriptions: VoidProductSubscriptionRecord[]
  products: VoidProduct[]
}

const dayKey = (timestamp: string | Date) =>
  startOfUtcDay(new Date(timestamp)).toISOString()

const subscriptionOpenOn = (
  subscription: VoidProductSubscriptionRecord,
  day: Date,
) => {
  const dayEnd = addDays(day, 1)
  if (new Date(subscription.started_at) >= dayEnd) return false
  if (subscription.ends_at) return new Date(subscription.ends_at) > day
  return subscription.status === 'active'
}

export const overviewPoints = ({
  days,
  meters,
  usageByMeter,
  subscriptions,
  products,
}: OverviewInputs): {
  points: VoidOverviewPoint[]
  distinctActiveIdentities: number
} => {
  const billed = new Map<string, number>()
  const active = new Map<string, Set<string>>()
  const everActive = new Set<string>()
  meters.forEach((meter, index) => {
    const price = Number(meter.unit_amount) * 100
    for (const series of usageByMeter[index]?.series ?? []) {
      const identity = series.external_identity_id
      for (const period of series.periods) {
        const value = period.value ?? 0
        if (value <= 0) continue
        const key = dayKey(period.timestamp)
        billed.set(key, (billed.get(key) ?? 0) + value * price)
        if (identity === null) continue
        everActive.add(identity)
        const set = active.get(key) ?? new Set<string>()
        set.add(identity)
        active.set(key, set)
      }
    }
  })

  const started = new Map<string, number>()
  for (const subscription of subscriptions) {
    const key = dayKey(subscription.started_at)
    started.set(key, (started.get(key) ?? 0) + 1)
  }

  const monthly = new Map(
    products.map((product) => [product.slug, monthlyCents(product.price)]),
  )

  const points = days.map((day) => {
    const key = day.toISOString()
    let mrr = 0
    let activeSubscriptions = 0
    for (const subscription of subscriptions) {
      if (!subscriptionOpenOn(subscription, day)) continue
      activeSubscriptions += 1
      mrr += monthly.get(subscription.product.slug) ?? 0
    }
    return {
      timestamp: day,
      billed: Math.round(billed.get(key) ?? 0),
      activeIdentities: active.get(key)?.size ?? 0,
      mrr,
      activeSubscriptions,
      newSubscriptions: started.get(key) ?? 0,
    }
  })
  return { points, distinctActiveIdentities: everActive.size }
}

const fetchOverview = async (organizationId: string) => {
  const now = new Date()
  const currentStart = startOfUtcDay(subDays(now, DAYS - 1))
  const previousStart = subDays(currentStart, DAYS)
  const [meters, deploys, subscriptions, products] = await Promise.all([
    voidRequest<VoidMeterRecord[]>(organizationId, '/meters'),
    voidRequest<VoidDeploy[]>(organizationId, '/deploys'),
    voidRequest<VoidProductSubscriptionRecord[]>(
      organizationId,
      '/subscriptions',
    ),
    voidRequest<VoidProduct[]>(organizationId, '/products'),
  ])
  const activeMeters = metersOfActive(meters, deploys)
  const usageByMeter = await Promise.all(
    activeMeters.map((meter) =>
      voidRequest<VoidMetrics>(
        organizationId,
        `/metrics${voidSearch({
          reducer_id: meter.usage_reducer_id,
          start: previousStart.toISOString(),
          end: now.toISOString(),
          interval: 'day',
          group_by: 'external_identity_id',
        })}`,
      ),
    ),
  )
  const window = (start: Date) => {
    const days = Array.from({ length: DAYS }, (_, index) =>
      addDays(start, index),
    )
    const { points, distinctActiveIdentities } = overviewPoints({
      days,
      meters: activeMeters,
      usageByMeter,
      subscriptions,
      products,
    })
    return overviewResponse(points, distinctActiveIdentities)
  }
  return { current: window(currentStart), previous: window(previousStart) }
}

export const useVoidOverview = (
  organizationId: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: overviewKeys.overview(organizationId),
    queryFn: () => fetchOverview(organizationId),
    retry: false,
    ...options,
  })
