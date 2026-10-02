import { StatusColor } from '@polar-sh/orbit'
import { RowPaymentMethod, rowPaymentMethod } from './paymentMethod'
import { isImported, needsAttention, ReviewRow } from './reviewRows'

export interface ReviewStatus {
  label: string
  // Undefined renders a neutral, untinted chip. Colour marks the exceptions
  // only: most rows import as they are, and tinting those too would leave
  // nothing standing out.
  color?: StatusColor
  // What moves with the subscription. Null for rows that stay on Stripe,
  // failed or have already switched, and for every other entity.
  paymentMethod: RowPaymentMethod | null
}

type Stage =
  | 'switched'
  | 'failed'
  | 'stays'
  | 'needs_info'
  | 'ready'
  | 'to_prepare'

const STAGES: Record<Stage, { label: string; color?: StatusColor }> = {
  switched: { label: 'Switched', color: 'gray' },
  failed: { label: 'Failed', color: 'red' },
  stays: { label: 'Stays on Stripe', color: 'red' },
  needs_info: { label: 'Needs info', color: 'yellow' },
  ready: { label: 'Ready' },
  to_prepare: { label: 'To prepare' },
}

function reviewStage(row: ReviewRow): Stage {
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
// record when it moves. For a subscription that will move, the answer names
// its payment method, since that decides whether its first Polar renewal can
// be charged. The source lifecycle (Active, Trialing, Past due) is a property
// of the Stripe record, so it lives in the row's detail modal.
export function reviewStatus(row: ReviewRow): ReviewStatus {
  const stage = reviewStage(row)
  const base = STAGES[stage]
  const paymentMethod =
    stage === 'stays' || stage === 'switched' || stage === 'failed'
      ? null
      : rowPaymentMethod(row)
  if (!paymentMethod) {
    return { ...base, paymentMethod }
  }
  const noCard = paymentMethod.kind === 'no_card'
  if (stage === 'needs_info') {
    return {
      label: noCard ? 'Needs info, no card' : base.label,
      color: base.color,
      paymentMethod,
    }
  }
  // A prepared subscription says so, so the merchant can still tell what an
  // import would add.
  const verb = stage === 'ready' ? 'Ready' : 'Moves'
  if (noCard) {
    return { label: `${verb}, no card`, color: 'yellow', paymentMethod }
  }
  return {
    label:
      paymentMethod.kind === 'bank_debit'
        ? `${verb}, bank debit`
        : `${verb} with card`,
    paymentMethod,
  }
}
