import { VoidIdentity } from './types'

export interface VoidIdentityRecord {
  id: string
  external_id: string
  parent_external_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface VoidIdentityDetailRecord extends VoidIdentityRecord {
  chain: string[]
  children: VoidIdentityRecord[]
}

export interface VoidCustomerRecord {
  id: string
  external_id: string
  email: string | null
  name: string | null
  created_at: string
}

export interface VoidLiveIdentity {
  id: string
  parent_id: string | null
  name: string
  kind: string
  note: string | null
  created_at: string
}

export interface VoidMeterBalance {
  usage: number
  remaining: number | null
  overage: number
  credits: number
  limit: 'hard' | 'soft' | 'unlimited' | null
  reason: string
}

export interface VoidIdentitySnapshot {
  at: string
  identity: VoidIdentityRecord
  root: VoidIdentityRecord
  customer: VoidCustomerRecord | null
  meters: Record<string, VoidMeterBalance>
  entitlements: string[]
}

export type VoidLiveSubscriptionStatus = 'active' | 'canceled' | 'revoked'

export interface VoidProductSubscriptionRecord {
  id: string
  product: { name: string; slug: string }
  external_identity_id: string
  status: VoidLiveSubscriptionStatus
  started_at: string
  current_period_end: string | null
  ends_at: string | null
}

export interface VoidLiveSubscription {
  id: string
  identity_id: string
  product: string
  status: VoidLiveSubscriptionStatus
  started_at: string
  current_period_end: string | null
  ends_at: string | null
}

export interface VoidEntitlementGrant {
  slug: string
  name: string
  subscription_id: string
  product_id: string
  product_slug: string
  external_identity_id: string
}

export interface VoidIdentityEntitlements {
  external_identity_id: string
  at: string
  entitlements: VoidEntitlementGrant[]
  slugs: string[]
}

export interface VoidEventRecord {
  id: string
  timestamp: string
  name: string
  source: 'user' | 'system'
  external_id: string
  external_identity_id: string | null
  external_root_id?: string | null
  metadata?: Record<string, unknown>
}

export interface VoidEventsList {
  items: VoidEventRecord[]
  pagination: { total_count: number }
}

export interface VoidMeterRecord {
  id: string
  name: string
  slug: string
  usage_reducer_id: string
  unit_amount: string
}

export interface VoidReducerRecord {
  id: string
  slug: string
}

export interface VoidMetricSeries {
  external_identity_id: string | null
  external_root_id: string | null
  periods: { timestamp: string; value: number | null }[]
  total: number | null
}

export interface VoidMetrics {
  reducer_id: string
  interval: string
  series: VoidMetricSeries[]
}

export interface VoidIdentityUsageMaps {
  usage: Record<string, number>
  cadence: Record<string, number[]>
  spend?: Record<string, number>
}

const metaString = (
  metadata: Record<string, unknown>,
  key: string,
): string | null => {
  const value = metadata[key]
  return typeof value === 'string' && value ? value : null
}

export const toIdentity = (
  identity: VoidIdentityRecord,
  customer?: Pick<VoidCustomerRecord, 'name'> | null,
): VoidLiveIdentity => {
  const metadata = identity.metadata ?? {}
  return {
    id: identity.external_id,
    parent_id: identity.parent_external_id,
    name:
      metaString(metadata, 'name') ?? customer?.name ?? identity.external_id,
    kind:
      metaString(metadata, 'kind') ??
      (identity.parent_external_id === null ? 'customer' : 'identity'),
    note: metaString(metadata, 'note'),
    created_at: identity.created_at,
  }
}

export const composeIdentities = (
  identities: VoidIdentityRecord[],
  customers: VoidCustomerRecord[],
): VoidLiveIdentity[] => {
  const byExternalId = new Map(
    customers.map((customer) => [customer.external_id, customer]),
  )
  return identities.map((identity) =>
    toIdentity(
      identity,
      identity.parent_external_id === null
        ? byExternalId.get(identity.external_id)
        : undefined,
    ),
  )
}

export const toLiveIdentity = (identity: VoidIdentity): VoidLiveIdentity => ({
  id: identity.id,
  parent_id: identity.parent_id,
  name: identity.name,
  kind: identity.kind,
  note: identity.note,
  created_at: identity.created_at,
})

export const toLiveSubscription = (
  row: VoidProductSubscriptionRecord,
): VoidLiveSubscription => ({
  id: row.id,
  identity_id: row.external_identity_id,
  product: row.product.name,
  status: row.status,
  started_at: row.started_at,
  current_period_end: row.current_period_end,
  ends_at: row.ends_at,
})

export const toLiveEvent = (event: VoidEventRecord) => ({
  id: event.id,
  name: event.name,
  source: event.source,
  identity_id: event.external_identity_id ?? '',
  timestamp: event.timestamp,
})

const groupOf = (entry: VoidMetricSeries) =>
  entry.external_identity_id ?? entry.external_root_id

export const usageFromMeters = (
  meters: VoidMeterRecord[],
  perMeter: VoidMetrics[],
): Pick<VoidIdentityUsageMaps, 'usage' | 'cadence'> => {
  const usage: Record<string, number> = {}
  const byDay: Record<string, Map<string, number>> = {}
  meters.forEach((meter, index) => {
    const price = Number(meter.unit_amount)
    for (const entry of perMeter[index]?.series ?? []) {
      const group = groupOf(entry)
      if (group === null) continue
      usage[group] =
        (usage[group] ?? 0) + Math.round((entry.total ?? 0) * price * 100)
      const days = (byDay[group] ??= new Map())
      for (const period of entry.periods) {
        days.set(
          period.timestamp,
          (days.get(period.timestamp) ?? 0) +
            Math.round((period.value ?? 0) * price * 100),
        )
      }
    }
  })
  return {
    usage,
    cadence: Object.fromEntries(
      Object.entries(byDay).map(([id, days]) => [
        id,
        [...days.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([, value]) => value),
      ]),
    ),
  }
}
