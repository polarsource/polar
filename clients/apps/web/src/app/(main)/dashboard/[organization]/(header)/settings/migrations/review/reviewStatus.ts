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
  if (row.status === 'skipped') {
    return { label: "Won't import", color: 'red' }
  }
  if (needsAttention(row)) {
    return { label: 'Needs info', color: 'yellow' }
  }
  return { label: 'Ready' }
}
