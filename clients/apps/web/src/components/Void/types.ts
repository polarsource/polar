import { ParsedMetricsResponse } from '@/hooks/queries'

export type VoidIdentityKind = 'human' | 'agent' | 'service'

export interface VoidIdentity {
  id: string
  parent_id: string | null
  name: string
  kind: VoidIdentityKind
  created_at: string
  note: string | null
  spend: number
  orders: number
  /** Own metered usage in the window, in cents. */
  usage: number
  /** Daily spend over the window, oldest first, in cents. Roots only. */
  cadence: number[]
  /** Units consumed per meter name in the window. */
  meters: Record<string, number>
  /** Daily credits consumed per meter name over the window, oldest first. */
  usageSeries: Record<string, number[]>
  /** Credits allotted to this customer. Roots only. */
  credits: number | null
}

export interface VoidSubscription {
  id: string
  identity_id: string
  product: string
  status: 'active' | 'canceled' | 'trialing'
  started_at: string
  current_period_end: string
  ends_at: string | null
}

export interface VoidEntitlement {
  slug: string
  name: string
  product: string
  subscription_id: string
  identity_id: string
}

export interface VoidMeter {
  id: string
  name: string
  units: number
  billed: number
}

export interface VoidPlan {
  name: string
  active: number
  mrr: number
}

export interface VoidDeployment {
  version: string
  hash: string
  time: string
  status: 'Active' | 'Superseded'
}

export interface VoidEvent {
  id: string
  name: string
  source: 'user' | 'system'
  identity_id: string
  timestamp: string
}

export interface VoidData {
  metrics: ParsedMetricsResponse
  previousMetrics: ParsedMetricsResponse
  identities: VoidIdentity[]
  meters: VoidMeter[]
  plans: VoidPlan[]
  deployments: VoidDeployment[]
  events: VoidEvent[]
  eventCount: number
  subscriptions: VoidSubscription[]
  entitlements: VoidEntitlement[]
}
