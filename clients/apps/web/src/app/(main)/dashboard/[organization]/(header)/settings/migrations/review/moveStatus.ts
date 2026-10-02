import { StatusColor } from '@polar-sh/orbit'
import { RowPaymentMethod, rowPaymentMethod } from './paymentMethod'
import { ReviewRow } from './reviewRows'
import { ReviewStatus, reviewStatus } from './reviewStatus'

export interface MoveStatus extends ReviewStatus {
  // Null for rows that stay on Stripe or have already moved.
  paymentMethod: RowPaymentMethod | null
}

export function moveStatus(row: ReviewRow): MoveStatus {
  const status = reviewStatus(row)
  const paymentMethod =
    status.stage === 'stays' || status.stage === 'switched'
      ? null
      : rowPaymentMethod(row)
  return { ...status, paymentMethod }
}

// The outcome variant names what happens to the row rather than where it is in
// the flow, so the payment method becomes part of the label.
export function moveOutcome(status: MoveStatus): {
  label: string
  color?: StatusColor
} {
  const method = status.paymentMethod
  if (!method || status.stage === 'failed') {
    return { label: status.label, color: status.color }
  }
  if (status.stage === 'needs_info') {
    return {
      label: method.kind === 'no_card' ? 'Needs info, no card' : 'Needs info',
      color: 'yellow',
    }
  }
  if (method.kind === 'no_card') {
    return { label: 'Moves, no card', color: 'yellow' }
  }
  if (method.kind === 'bank_debit') return { label: 'Moves, bank debit' }
  return { label: 'Moves with card' }
}
