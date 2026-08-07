import { StatusColor } from '@polar-sh/orbit'
import { isImported, needsAttention, ReviewRow } from './reviewRows'

export interface ReviewStatus {
  label: string
  // Undefined renders a neutral, untinted chip. Colour marks the exceptions
  // only: most rows import as they are, and tinting those too would leave
  // nothing standing out.
  color?: StatusColor
}

// One question, asked the same way for every entity: what happens to this
// record at import. The source lifecycle (Active, Trialing, Past due) is a
// property of the Stripe record, so it lives in the row's detail modal.
export function reviewStatus(row: ReviewRow): ReviewStatus {
  if (isImported(row)) {
    return { label: 'Imported', color: 'gray' }
  }
  if (row.import_status === 'failed') {
    return { label: 'Import failed', color: 'red' }
  }
  // A record can be marked "won't import" at two stages: precheck classifies
  // it as `status === 'skipped'` up front, and the importer may mark a record
  // `import_status === 'skipped'` at runtime (e.g. when a dependency wasn't
  // selected). Either way the record stays on the source, so the indicator
  // must reflect the runtime reality — not just the precheck prediction.
  if (row.status === 'skipped' || row.import_status === 'skipped') {
    return { label: "Won't import", color: 'red' }
  }
  if (needsAttention(row)) {
    return { label: 'Needs info', color: 'yellow' }
  }
  return { label: 'Ready' }
}
