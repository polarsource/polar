import { useSyncExternalStore } from 'react'

/**
 * One stream of events runs under the whole manual. The driver emits them, the controls on the page set the
 * rates and the grant, and the live figures fold over the list. Everything a figure shows is derived from it.
 */

export type EventName =
  | 'tokens.in'
  | 'tokens.out'
  | 'image.gen'
  | 'api.call'
  | 'credit.granted'

export type Traffic = 'off' | 'slow' | 'fast'

export interface SimEvent {
  id: string
  /** Position in the ledger, from 1. */
  n: number
  name: EventName
  customer: string
  actor: string
  quantity: number
  at: number
}

export interface SimState {
  events: SimEvent[]
  /** Count of every event ever emitted, the ledger's head. */
  head: number
  /** Units per meter since the start. */
  usage: Record<EventName, number>
  /** Credits remaining from the latest grant. */
  credits: number
  /** Credits consumed over every grant. */
  consumed: number
  /** USD per unit, as the catalogue prices them. */
  rates: Record<EventName, number>
  /** Credits each grant adds. */
  grant: number
  traffic: Traffic
}

export const RATE_CHOICES = [3, 10, 15]
export const GRANT_CHOICES = [5_000, 10_000, 25_000]
export const TRAFFIC_CHOICES: Traffic[] = ['off', 'slow', 'fast']

const KEEP = 64
const ACTORS = ['run_7f2', 'run_91c', 'agent_ada', 'run_b03', 'key_live_4']

const fresh = (): SimState => ({
  events: [],
  head: 0,
  usage: {
    'tokens.in': 0,
    'tokens.out': 0,
    'image.gen': 0,
    'api.call': 0,
    'credit.granted': 0,
  },
  credits: 0,
  consumed: 0,
  rates: {
    'tokens.in': 1 / 1_000_000,
    'tokens.out': 3 / 1_000_000,
    'image.gen': 0.04,
    'api.call': 0.001,
    'credit.granted': 0,
  },
  grant: 10_000,
  traffic: 'slow',
})

let state = fresh()
const listeners = new Set<() => void>()
const set = (next: SimState) => {
  state = next
  listeners.forEach((l) => l())
}

const rand = (n: number) => Math.floor(Math.random() * n)
const pick = <T>(xs: readonly T[]) => xs[rand(xs.length)]

const draft = (): Omit<SimEvent, 'id' | 'n' | 'at'> => {
  const r = Math.random()
  const actor = pick(ACTORS)
  const customer = 'acme'
  if (r < 0.42)
    return { name: 'tokens.out', quantity: 120 + rand(1400), customer, actor }
  if (r < 0.72)
    return { name: 'tokens.in', quantity: 300 + rand(2600), customer, actor }
  if (r < 0.88) return { name: 'api.call', quantity: 1, customer, actor }
  return { name: 'image.gen', quantity: 1 + rand(3), customer, actor }
}

const append = (e: Omit<SimEvent, 'id' | 'n'>, s: SimState): SimState => {
  const n = s.head + 1
  const ev: SimEvent = { ...e, n, id: `evt_${n.toString(36).padStart(5, '0')}` }
  const drain = ev.name === 'tokens.out' ? ev.quantity : 0
  return {
    ...s,
    events: [...s.events, ev].slice(-KEEP),
    head: n,
    usage: { ...s.usage, [ev.name]: s.usage[ev.name] + ev.quantity },
    credits:
      ev.name === 'credit.granted'
        ? s.credits + ev.quantity
        : s.credits - drain,
    consumed: s.consumed + drain,
  }
}

/** Emit one event. A grant lands first whenever the balance would cross zero: the book's chapter on it. */
export function emit(at = Date.now()) {
  let next = state
  const e = draft()
  const drain = e.name === 'tokens.out' ? e.quantity : 0
  if (next.credits - drain < 0)
    next = append(
      {
        name: 'credit.granted',
        quantity: next.grant,
        customer: 'acme',
        actor: 'polar',
        at,
      },
      next,
    )
  set(append({ ...e, at }, next))
}

/** The book never opens on an empty ledger: a grant and a few minutes of traffic are already on it. */
export function seed(count = 12) {
  if (state.head > 0) return
  const now = Date.now()
  for (let i = count; i > 0; i--) emit(now - i * 1700)
}

/** Back to an empty ledger, with the settings kept. */
export function reset() {
  set({
    ...fresh(),
    rates: state.rates,
    grant: state.grant,
    traffic: state.traffic,
  })
  seed()
}

export const setRate = (perMillion: number) =>
  set({
    ...state,
    rates: { ...state.rates, 'tokens.out': perMillion / 1_000_000 },
  })
export const setGrant = (grant: number) => set({ ...state, grant })
export const setTraffic = (traffic: Traffic) => set({ ...state, traffic })

export function useSim<T>(select: (s: SimState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => select(state),
    () => select(state),
  )
}

/** USD for a meter's usage so far. */
export const usd = (s: SimState, name: EventName, units: number) =>
  units * s.rates[name]

export const money = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const num = (v: number) => v.toLocaleString('en-US')
