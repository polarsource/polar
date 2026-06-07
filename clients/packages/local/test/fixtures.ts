/**
 * A hand-built billing scenario in Polar's event shape. Pure data — "no
 * databases, no mocks, no setup. Just input and output." Meters filter by event
 * `name` and aggregate over `metadata`, exactly like Polar.
 */
import { product, perUnit } from '../src/dsl'
import type { Period, UsageEvent } from '../src/events'
import { count, maxOf, sumOf } from '../src/meter'
import { cents, micros } from '../src/money'

/** A pay-as-you-go API product. */
export const plan = product('api-access')
  .meter('tokens', sumOf('amount'), perUnit(micros(2n))) // $0.000002 / token
  .meter('requests', count(), perUnit(micros(50n))) // $0.00005 / request
  .meter('seats', maxOf('amount'), perUnit(cents(500))) // $5.00 / peak seat
  .build()

export const period: Period = {
  from: Date.UTC(2026, 0, 1),
  to: Date.UTC(2026, 1, 1),
}

const iso = (day: number) => new Date(Date.UTC(2026, 0, day)).toISOString()

/** Acme's January usage. Seq order is the canonical replay order. */
export const events: readonly UsageEvent[] = [
  ev(0, 'tokens', { amount: 1_000_000 }, 3),
  ev(1, 'requests', {}, 3),
  ev(2, 'seats', { amount: 3 }, 5),
  ev(3, 'tokens', { amount: 500_000 }, 9),
  ev(4, 'requests', {}, 9),
  ev(5, 'seats', { amount: 7 }, 14), // peak
  ev(6, 'requests', {}, 20),
  ev(7, 'seats', { amount: 5 }, 27), // back down — maxOf keeps 7
  ev(8, 'tokens', { amount: 250_000 }, 28),
]

function ev(
  seq: number,
  name: string,
  metadata: Record<string, number>,
  day: number,
): UsageEvent {
  return {
    kind: 'usage',
    v: 1,
    seq,
    id: `evt_${seq}`,
    name,
    external_customer_id: 'acme',
    timestamp: iso(day),
    external_id: `acme:${name}:${seq}`,
    metadata,
  }
}
