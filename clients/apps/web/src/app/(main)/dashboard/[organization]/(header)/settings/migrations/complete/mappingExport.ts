import { MAPPING_KINDS, MappingKind, MappingRow } from './idMapping'

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

function downloadFile(filename: string, contents: string, type: string): void {
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
