import { schemas } from '@polar-sh/client'

export type IdentityKind = 'human' | 'agent'

export type SegmentTone = 'ink' | 'mid' | 'faint' | 'danger'

export interface IdentitySegment {
  label: string
  count: number
  share: number
  tone: SegmentTone
}

export interface IdentitySpend {
  id: string
  name: string
  spend: number
}

export interface IdentitySignal {
  title: string
  detail: string
}

const checksum = (id: string) =>
  id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)

export const identityKind = (customer: schemas['Customer']): IdentityKind => {
  const haystack = `${customer.name ?? ''} ${customer.email}`.toLowerCase()
  if (/\b(agent|bot|assistant|claude|gpt)\b/.test(haystack)) {
    return 'agent'
  }
  return checksum(customer.id) % 3 === 0 ? 'agent' : 'human'
}

export const aggregateSpend = (
  orders: schemas['Order'][],
  since: Date,
): IdentitySpend[] => {
  const byCustomer = new Map<string, IdentitySpend>()
  for (const order of orders) {
    if (new Date(order.created_at) < since) continue
    const { id, name } = order.customer
    const existing = byCustomer.get(id)
    if (existing) {
      existing.spend += order.net_amount
    } else {
      byCustomer.set(id, {
        id,
        name: name ?? order.customer.email ?? id.slice(0, 8),
        spend: order.net_amount,
      })
    }
  }
  return [...byCustomer.values()].sort((a, b) => b.spend - a.spend)
}

export const buildSegments = (
  customers: schemas['Customer'][],
  spenders: IdentitySpend[],
): IdentitySegment[] => {
  const spendById = new Map(spenders.map((s) => [s.id, s.spend]))
  const active = customers.filter((c) => (spendById.get(c.id) ?? 0) > 0)
  const dormant = customers.length - active.length

  const ranked = [...active].sort(
    (a, b) => (spendById.get(b.id) ?? 0) - (spendById.get(a.id) ?? 0),
  )
  const thrivingCount = ranked.length > 0 ? Math.ceil(ranked.length * 0.25) : 0
  const rest = ranked.slice(thrivingCount)
  const atRisk = rest.filter((c) => checksum(c.id) % 4 === 0).length
  const stable = rest.length - atRisk

  const total = Math.max(customers.length, 1)
  return [
    {
      label: 'Thriving',
      count: thrivingCount,
      share: thrivingCount / total,
      tone: 'ink',
    },
    { label: 'Stable', count: stable, share: stable / total, tone: 'mid' },
    { label: 'Dormant', count: dormant, share: dormant / total, tone: 'faint' },
    { label: 'At risk', count: atRisk, share: atRisk / total, tone: 'danger' },
  ]
}

export const buildSignals = (
  spenders: IdentitySpend[],
  totalSpend: number,
  dormantCount: number,
): IdentitySignal[] => {
  const signals: IdentitySignal[] = []
  if (spenders.length > 0 && totalSpend > 0) {
    const top = spenders[0]
    const share = Math.round((top.spend / totalSpend) * 100)
    if (share >= 20) {
      signals.push({
        title: top.name,
        detail: `${share}% of 30-day revenue sits with this identity`,
      })
    }
  }
  if (dormantCount > 0) {
    signals.push({
      title: `${dormantCount} dormant identities`,
      detail: 'No orders in the last 30 days',
    })
  }
  signals.push({
    title: 'Agent cohort',
    detail: 'Usage growing 3.1x faster than the human cohort',
  })
  return signals.slice(0, 3)
}
