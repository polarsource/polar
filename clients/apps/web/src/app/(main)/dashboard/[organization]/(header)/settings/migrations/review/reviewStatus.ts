import { isImported, needsAttention, ReviewRow } from './reviewRows'

type LabelColor = 'default' | 'muted' | 'warning' | 'danger'

export interface ReviewStatus {
  label: string
  color: LabelColor
}

// One question, asked the same way for every entity: what happens to this
// record at import. The source lifecycle (Active, Trialing, Past due) is a
// property of the Stripe record, so it lives in the row's detail modal.
//
// The word carries the meaning, so there's no status dot. Colour marks the
// exceptions only: most rows import as they are, and colouring those too would
// leave nothing standing out.
export function reviewStatus(row: ReviewRow): ReviewStatus {
  if (isImported(row)) {
    return { label: 'Imported', color: 'muted' }
  }
  if (row.status === 'skipped') {
    return { label: "Won't import", color: 'danger' }
  }
  if (needsAttention(row)) {
    return { label: 'Needs info', color: 'warning' }
  }
  return { label: 'Ready', color: 'default' }
}
