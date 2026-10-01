import { MAPPING_KINDS, MappingKind, MappingRow } from './idMapping'
import { CustomerRow } from './viewModels'

interface MappingEntry {
  type: MappingKind
  stripe_id: string
  polar_id: string | null
  name: string
  detail: string | null
  status: MappingRow['state']
}

const CSV_COLUMNS: (keyof MappingEntry)[] = [
  'type',
  'stripe_id',
  'polar_id',
  'name',
  'detail',
  'status',
]

// A list, not a `{ stripe_id: polar_id }` map: one Stripe product becomes a
// Polar product per billing interval, so a Stripe ID can have several rows.
export function mappingEntries(
  mapping: Record<MappingKind, MappingRow[]>,
): MappingEntry[] {
  return MAPPING_KINDS.flatMap((kind) =>
    mapping[kind].map((row) => ({
      type: kind,
      stripe_id: row.stripeId,
      polar_id: row.polarId,
      name: row.label,
      detail: row.detail,
      status: row.state,
    })),
  )
}

const csvCell = (value: string | null) => {
  if (value == null) return ''
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function mappingCsv(mapping: Record<MappingKind, MappingRow[]>): string {
  const lines = [
    CSV_COLUMNS.join(','),
    ...mappingEntries(mapping).map((entry) =>
      CSV_COLUMNS.map((column) => csvCell(entry[column])).join(','),
    ),
  ]
  return `${lines.join('\n')}\n`
}

const CUSTOMER_CSV_COLUMNS = [
  'email',
  'stripe_customer_id',
  'polar_customer_id',
  'stripe_subscription_id',
  'polar_subscription_id',
  'subscription_status',
]

// One line per subscription, keyed the way a merchant's `users` table is:
// both customer IDs next to both subscription IDs.
export function customerCsv(rows: CustomerRow[]): string {
  const lines = [CUSTOMER_CSV_COLUMNS.join(',')]
  for (const row of rows) {
    const customer = [row.label, row.stripeId, row.customer?.polarId ?? null]
    const subscriptions = row.subscriptions.length ? row.subscriptions : [null]
    for (const subscription of subscriptions) {
      lines.push(
        [
          ...customer,
          subscription?.stripeId ?? null,
          subscription?.polarId ?? null,
          subscription?.state ?? null,
        ]
          .map(csvCell)
          .join(','),
      )
    }
  }
  return `${lines.join('\n')}\n`
}

export function downloadFile(
  filename: string,
  contents: string,
  type: string,
): void {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadMapping(
  mapping: Record<MappingKind, MappingRow[]>,
  format: 'csv' | 'json',
): void {
  if (format === 'csv') {
    downloadFile('stripe-to-polar-ids.csv', mappingCsv(mapping), 'text/csv')
    return
  }
  downloadFile(
    'stripe-to-polar-ids.json',
    JSON.stringify(mappingEntries(mapping), null, 2),
    'application/json',
  )
}
