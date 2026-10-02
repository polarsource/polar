import { StatusColor } from '@polar-sh/orbit'
import { isImported, needsAttention, ReviewRow } from './reviewRows'

export type ReviewStage =
  | 'switched'
  | 'failed'
  | 'stays'
  | 'needs_info'
  | 'ready'
  | 'to_prepare'

export interface ReviewStatus {
  stage: ReviewStage
  label: string
  // Undefined renders a neutral, untinted chip. Colour marks the exceptions
  // only: most rows import as they are, and tinting those too would leave
  // nothing standing out.
  color?: StatusColor
}

const STAGES: Record<ReviewStage, Omit<ReviewStatus, 'stage'>> = {
  switched: { label: 'Switched', color: 'gray' },
  failed: { label: 'Failed', color: 'red' },
  stays: { label: 'Stays on Stripe', color: 'red' },
  needs_info: { label: 'Needs info', color: 'yellow' },
  ready: { label: 'Ready' },
  to_prepare: { label: 'To prepare' },
}

function reviewStage(row: ReviewRow): ReviewStage {
  if (isImported(row)) return 'switched'
  if (row.import_status === 'failed') return 'failed'
  // A record can be marked "won't import" at two stages: precheck classifies
  // it as `status === 'skipped'` up front, and the importer may mark a record
  // `import_status === 'skipped'` at runtime (e.g. when a dependency wasn't
  // selected). Either way the record stays on the source, so the indicator
  // must reflect the runtime reality — not just the precheck prediction.
  if (row.status === 'skipped' || row.import_status === 'skipped') {
    return 'stays'
  }
  if (row.import_status === 'pending' && row.dependencies_imported) {
    return 'ready'
  }
  if (needsAttention(row)) return 'needs_info'
  return 'to_prepare'
}

// One question, asked the same way for every entity: what happens to this
// record at import. The source lifecycle (Active, Trialing, Past due) is a
// property of the Stripe record, so it lives in the row's detail modal.
export function reviewStatus(row: ReviewRow): ReviewStatus {
  const stage = reviewStage(row)
  return { stage, ...STAGES[stage] }
}
