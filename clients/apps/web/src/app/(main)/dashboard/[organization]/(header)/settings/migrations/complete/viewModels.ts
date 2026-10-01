import { schemas } from '@polar-sh/client'
import {
  MAPPING_KINDS,
  MappingKind,
  MappingRow,
  MappingState,
} from './mappingTypes'

type Mapping = Record<MappingKind, MappingRow[]>

export const MATRIX_STATES: MappingState[] = [
  'moved',
  'in_polar',
  'not_switched',
  'left_on_stripe',
  'failed',
  'not_imported',
]

export function kindStateMatrix(
  mapping: Mapping,
): Record<MappingKind, Record<MappingState, number>> {
  const matrix = {} as Record<MappingKind, Record<MappingState, number>>
  for (const kind of MAPPING_KINDS) {
    matrix[kind] = Object.fromEntries(
      MATRIX_STATES.map((state) => [state, 0]),
    ) as Record<MappingState, number>
    for (const row of mapping[kind]) matrix[kind][row.state] += 1
  }
  return matrix
}

export interface CustomerRow {
  stripeId: string
  label: string
  customer: MappingRow | null
  subscriptions: MappingRow[]
}

// The shape a merchant's own `users` table needs: one customer with the
// subscriptions it owns. Customers imported by an earlier migration aren't in
// this one's records, so they come from the subscription alone.
export function customerRows(mapping: Mapping): CustomerRow[] {
  const rows = new Map<string, CustomerRow>()
  for (const customer of mapping.customers) {
    rows.set(customer.stripeId, {
      stripeId: customer.stripeId,
      label: customer.label,
      customer,
      subscriptions: [],
    })
  }
  for (const subscription of mapping.subscriptions) {
    const stripeId =
      subscription.record.customer_source_id ?? subscription.stripeId
    const row = rows.get(stripeId) ?? {
      stripeId,
      label: subscription.label,
      customer: null,
      subscriptions: [],
    }
    row.subscriptions.push(subscription)
    rows.set(stripeId, row)
  }
  return [...rows.values()]
}

export interface SwitchBatch {
  day: string
  count: number
}

// No batch log is stored, but each switch creates the Polar subscription, so
// the day it was created is the day its batch ran.
export function switchBatches(subscriptions: MappingRow[]): SwitchBatch[] {
  const counts = new Map<string, number>()
  for (const row of subscriptions) {
    if (!row.switchedAt) continue
    const day = row.switchedAt.slice(0, 10)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([day, count]) => ({ day, count }))
    .toSorted((a, b) => a.day.localeCompare(b.day))
}

export interface ProgressSegment {
  key: 'moved' | 'ready' | 'left' | 'failed' | 'unprepared'
  label: string
  count: number
}

export function switchProgress(
  report: schemas['MerchantMigrationCutoverReport'],
  subscriptions: MappingRow[],
): ProgressSegment[] {
  return [
    { key: 'moved', label: 'Billing on Polar', count: report.moved },
    { key: 'ready', label: 'Ready to switch', count: report.pending },
    { key: 'left', label: 'Left on Stripe', count: report.skipped },
    { key: 'failed', label: 'Failed', count: report.failed },
    {
      key: 'unprepared',
      label: "Can't switch yet",
      count: Math.max(0, subscriptions.length - report.total),
    },
  ]
}

export const isSwitchDone = (
  report: schemas['MerchantMigrationCutoverReport'],
) => report.total > 0 && report.pending === 0
