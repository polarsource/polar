import { isImported, needsAttention, ReviewRow } from './reviewRows'

type DotColor = 'text-warning' | 'text-danger' | 'text-tertiary'
type LabelColor = 'default' | 'muted'

export interface ReviewStatus {
  label: string
  dot: DotColor
  labelColor: LabelColor
}

// One question, asked the same way for every entity: what happens to this
// record at import. The source lifecycle (Active, Trialing, Past due) is a
// property of the Stripe record, so it lives in the row's detail modal.
//
// Colour marks the exceptions only. Most rows import as they are, so painting
// those green would leave the whole column shouting.
export function reviewStatus(row: ReviewRow): ReviewStatus {
  if (isImported(row)) {
    return { label: 'Imported', dot: 'text-tertiary', labelColor: 'muted' }
  }
  if (row.status === 'skipped') {
    return { label: "Won't import", dot: 'text-danger', labelColor: 'muted' }
  }
  if (needsAttention(row)) {
    return { label: 'Needs info', dot: 'text-warning', labelColor: 'default' }
  }
  return { label: 'Ready', dot: 'text-tertiary', labelColor: 'default' }
}
