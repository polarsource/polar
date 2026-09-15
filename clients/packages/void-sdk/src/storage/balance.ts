/** Mirrors server/void/meter/balance.py; timestamps are milliseconds internally. */
import type { MeterEvent, MeterCycle, Subscription } from '../api/generated'

export type Limit = 'hard' | 'soft' | 'unlimited'
interface Sub {
  id: string
  at: number
  anchor: number
  interval: Subscription['meter_interval']
  count: number
  cap: number | null
  /** Credits granted at the start of every period. */
  included: number
  limit: Limit
  ended: boolean
}
export interface FoldState {
  subscription: Sub | null
  boundary: number | null
  boundaries: number[]
  cycles: Map<number, MeterCycle>
  credits: number
  usage: number
}
export const emptyState = (): FoldState => ({
  subscription: null,
  boundary: null,
  boundaries: [],
  cycles: new Map(),
  credits: 0,
  usage: 0,
})
const iso = (at: number) => new Date(at).toISOString()
const remaining = (s: FoldState) => Math.max(s.credits - s.usage, 0)
const deltas: Partial<Record<Subscription['meter_interval'], number>> = {
  hour: 3600000,
  day: 86400000,
  week: 604800000,
}
function step(s: Sub, k: number): number {
  const delta = deltas[s.interval]
  if (delta !== undefined) return s.anchor + delta * k * s.count
  const anchor = new Date(s.anchor)
  const month =
    anchor.getUTCMonth() + k * s.count * (s.interval === 'year' ? 12 : 1)
  const date = new Date(s.anchor)
  date.setUTCDate(1)
  date.setUTCFullYear(anchor.getUTCFullYear(), month)
  const end = new Date(date)
  end.setUTCMonth(end.getUTCMonth() + 1, 0)
  date.setUTCDate(Math.min(anchor.getUTCDate(), end.getUTCDate()))
  return date.getTime()
}
/** The end of the current period, or null without a running subscription. */
export const nextBoundary = (s: FoldState): number | null => next(s)
function next(s: FoldState): number | null {
  const sub = s.subscription
  if (!sub || sub.ended) return null
  const floor = Math.max(sub.at, s.boundary ?? sub.at)
  const delta = deltas[sub.interval]
  let k = delta
    ? Math.max(0, Math.ceil((floor - sub.anchor) / (delta * sub.count)))
    : 0
  while (step(sub, k) < floor) k++
  let boundary = step(sub, k)
  if (boundary === s.boundary) boundary = step(sub, k + 1)
  return boundary
}
function advance(s: FoldState, until: number) {
  for (
    let boundary = next(s);
    boundary !== null && boundary <= until;
    boundary = next(s)
  ) {
    if (s.boundary !== null) {
      const rollover = Math.min(remaining(s), s.subscription!.cap ?? Infinity)
      s.cycles.set(boundary, {
        subscription_id: s.subscription!.id,
        period_start: iso(s.boundary),
        period_end: iso(boundary),
        credits: s.credits,
        usage: s.usage,
        expired: remaining(s) - rollover,
        rollover,
        overage: Math.max(s.usage - s.credits, 0),
      })
      s.credits = rollover + s.subscription!.included
      s.usage = 0
    }
    s.boundary = boundary
    s.boundaries.push(boundary)
  }
}
export function storedCycle(data: MeterEvent['data']): MeterCycle | null {
  const fields = ['credits', 'usage', 'expired', 'rollover', 'overage'] as const
  if (
    typeof data.subscription_id !== 'string' ||
    typeof data.period_start !== 'string' ||
    typeof data.period_end !== 'string'
  )
    return null
  if (
    ![data.period_start, data.period_end].every((t) =>
      Number.isFinite(Date.parse(t)),
    )
  )
    return null
  if (
    !fields.every(
      (f) => typeof data[f] === 'number' && Number.isFinite(data[f]),
    )
  )
    return null
  return {
    subscription_id: data.subscription_id,
    period_start: iso(Date.parse(data.period_start)),
    period_end: iso(Date.parse(data.period_end)),
    credits: Number(data.credits),
    usage: Number(data.usage),
    expired: Number(data.expired),
    rollover: Number(data.rollover),
    overage: Number(data.overage),
  }
}
function change(s: FoldState, event: MeterEvent) {
  const at = Date.parse(event.at),
    data = event.data
  if (event.name === 'meter.cycled') {
    const stored = storedCycle(data),
      computed = s.cycles.get(at)
    if (
      stored &&
      computed &&
      s.subscription &&
      s.boundary === at &&
      Date.parse(stored.period_end) === at &&
      stored.subscription_id === s.subscription.id &&
      stored.period_start === computed.period_start
    ) {
      s.cycles.set(at, stored)
      s.credits = Math.max(0, s.credits + stored.rollover - computed.rollover)
    }
    return
  }
  if (
    event.name === 'subscription.canceled' ||
    event.name === 'subscription.revoked'
  ) {
    if (!s.subscription) return
    s.subscription.ended = true
    s.subscription.at = at
    if (event.name === 'subscription.revoked') s.credits = 0
    return
  }
  if (!['subscription.created', 'subscription.updated'].includes(event.name))
    return
  const prior = s.subscription && !s.subscription.ended ? s.subscription : null
  const interval = data.meter_interval ?? prior?.interval
  const count = data.meter_interval_count ?? prior?.count ?? 1
  const cap =
    data.rollover_cap === undefined ? (prior?.cap ?? null) : data.rollover_cap
  const anchor =
    data.anchor === undefined
      ? (prior?.anchor ?? at)
      : Date.parse(String(data.anchor))
  const id = data.id ?? prior?.id ?? event.id
  const included = data.included ?? prior?.included ?? 0
  const limit = data.limit ?? prior?.limit ?? 'hard'
  if (
    !['hour', 'day', 'week', 'month', 'year'].includes(String(interval)) ||
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 1 ||
    (cap !== null && (typeof cap !== 'number' || cap < 0)) ||
    typeof included !== 'number' ||
    !Number.isFinite(included) ||
    included < 0 ||
    !['hard', 'soft', 'unlimited'].includes(String(limit)) ||
    !Number.isFinite(anchor) ||
    typeof id !== 'string'
  )
    return
  s.subscription = {
    id,
    at,
    anchor,
    interval: interval as Sub['interval'],
    count,
    cap: cap as number | null,
    included,
    limit: limit as Limit,
    ended: false,
  }
  // The first period's allowance lands with the subscription; later ones at
  // each boundary in `advance`. An update grants only what the new terms add.
  s.credits += Math.max(0, included - (prior?.included ?? 0))
}
export function fold(
  initial: FoldState,
  events: readonly MeterEvent[],
  credits: readonly [number, number][],
  usage: readonly [number, number][],
  until: number,
): FoldState {
  const state = structuredClone(initial)
  const stream: {
    at: number
    kind: number
    event?: MeterEvent
    value?: number
  }[] = [
    ...events
      .filter((e) => Date.parse(e.at) <= until)
      .map((event) => ({ at: Date.parse(event.at), kind: 0, event })),
    ...credits
      .filter(([at]) => at <= until)
      .map(([at, value]) => ({ at, kind: 1, value })),
    ...usage
      .filter(([at]) => at < until)
      .map(([at, value]) => ({ at, kind: 2, value })),
  ]
  stream.sort((a, b) => a.at - b.at || a.kind - b.kind)
  for (const item of stream) {
    advance(state, item.at)
    if (item.event) change(state, item.event)
    else if (item.kind === 1)
      state.credits = Math.max(0, state.credits + item.value!)
    else state.usage += item.value!
  }
  advance(state, until)
  return state
}

/** Resume from a compact remote state, without loading completed cycles. */
export function resume(state: import('../api/generated').State): FoldState {
  const sub = state.subscription
  return {
    subscription: sub
      ? {
          id: sub.id,
          at: Date.parse(sub.at),
          anchor: Date.parse(sub.anchor),
          interval: sub.meter_interval,
          count: sub.meter_interval_count ?? 1,
          cap: sub.rollover_cap ?? null,
          included: sub.included ?? 0,
          limit: sub.limit ?? 'hard',
          ended: sub.ended ?? false,
        }
      : null,
    boundary: state.boundary ? Date.parse(state.boundary) : null,
    boundaries: [],
    cycles: new Map(),
    credits: state.credits ?? 0,
    usage: state.usage ?? 0,
  }
}
