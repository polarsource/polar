import { isImported, needsAttention, ReviewRow } from './reviewRows'

type DotColor =
  | 'text-success'
  | 'text-warning'
  | 'text-danger'
  | 'text-tertiary'
type LabelColor = 'default' | 'muted'

export interface ReviewStatus {
  label: string
  dot: DotColor
  labelColor: LabelColor
}

// A single, consistent status cell across every entity. Subscriptions surface
// their lifecycle (Active, Trialing, Past due); products and customers surface
// their import disposition (Ready, Needs info, Won't import).
export function reviewStatus(row: ReviewRow): ReviewStatus {
  if (isImported(row)) {
    return { label: 'Imported', dot: 'text-tertiary', labelColor: 'muted' }
  }

  if (row.status === 'skipped') {
    const lifecycle = row.entity === 'subscriptions' ? row.subtitle : null
    return {
      label: lifecycle || "Won't import",
      dot: 'text-danger',
      labelColor: 'muted',
    }
  }

  const attention = needsAttention(row)
  const dot: DotColor = attention ? 'text-warning' : 'text-success'

  if (row.entity === 'subscriptions') {
    return { label: row.subtitle || 'Active', dot, labelColor: 'default' }
  }

  return {
    label: attention ? 'Needs info' : 'Ready',
    dot,
    labelColor: 'default',
  }
}
