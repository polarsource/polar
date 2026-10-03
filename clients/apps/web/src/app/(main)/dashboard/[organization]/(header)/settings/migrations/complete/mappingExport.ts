import { IdMapping, MAPPING_KINDS } from './idMapping'

const COLUMNS = ['type', 'stripe_id', 'polar_id', 'name', 'detail', 'status']

// A list, not a `{ stripe_id: polar_id }` map: one Stripe product becomes a
// Polar product per billing interval, so a Stripe ID can have several rows.
export const mappingEntries = (mapping: IdMapping) =>
  MAPPING_KINDS.flatMap((kind) =>
    mapping[kind].map((row) => [
      kind,
      row.stripeId,
      row.polarId,
      row.label,
      row.detail,
      row.state,
    ]),
  )

const csvCell = (value: string | null) =>
  value != null && /[",\n\r]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : (value ?? '')

export const mappingCsv = (mapping: IdMapping) =>
  [COLUMNS, ...mappingEntries(mapping)]
    .map((row) => row.map(csvCell).join(','))
    .join('\n') + '\n'

export function downloadMapping(mapping: IdMapping, format: 'csv' | 'json') {
  const contents =
    format === 'csv'
      ? mappingCsv(mapping)
      : JSON.stringify(
          mappingEntries(mapping).map((row) =>
            Object.fromEntries(COLUMNS.map((column, i) => [column, row[i]])),
          ),
          null,
          2,
        )
  const link = document.createElement('a')
  link.href = URL.createObjectURL(
    new Blob([contents], {
      type: format === 'csv' ? 'text/csv' : 'application/json',
    }),
  )
  link.download = `stripe-to-polar-ids.${format}`
  link.click()
  URL.revokeObjectURL(link.href)
}
