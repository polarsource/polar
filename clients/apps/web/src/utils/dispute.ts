import { schemas } from '@polar-sh/client'
import type { StatusColor } from '@polar-sh/orbit'

export const DisputeStatusDisplayTitle: Record<
  schemas['DisputeStatus'],
  string
> = {
  prevented: 'Prevented',
  early_warning: 'Early Warning',
  needs_response: 'Needs Response',
  under_review: 'Under Review',
  won: 'Won',
  lost: 'Lost',
  accepted: 'Accepted',
}

export const DisputeStatusDisplayColor: Record<
  schemas['DisputeStatus'],
  StatusColor
> = {
  prevented: 'green',
  early_warning: 'yellow',
  needs_response: 'yellow',
  under_review: 'yellow',
  won: 'green',
  lost: 'red',
  accepted: 'gray',
}

export type DisputeStatusFilter = schemas['DisputeStatus'] | 'any'

export const isDisputeStatus = (
  value: string,
): value is schemas['DisputeStatus'] => value in DisputeStatusDisplayTitle

export const getDisputeDisplayStatus = (
  dispute: schemas['Dispute'],
): { title: string; color: StatusColor } => ({
  title: DisputeStatusDisplayTitle[dispute.status],
  color: DisputeStatusDisplayColor[dispute.status],
})

export const DisputeReasonDisplay: Record<string, string> = {
  bank_cannot_process: 'Bank cannot process',
  check_returned: 'Check returned',
  credit_not_processed: 'Credit not processed',
  customer_initiated: 'Customer initiated',
  debit_not_authorized: 'Debit not authorized',
  duplicate: 'Duplicate',
  fraudulent: 'Fraudulent',
  general: 'General',
  incorrect_account_details: 'Incorrect account details',
  insufficient_funds: 'Insufficient funds',
  product_not_received: 'Product not received',
  product_unacceptable: 'Product unacceptable',
  subscription_canceled: 'Subscription canceled',
  unrecognized: 'Unrecognized',
}

export const getDisputeReasonDisplay = (reason: string | null): string =>
  reason ? (DisputeReasonDisplay[reason] ?? reason.replace(/_/g, ' ')) : '—'

export const DisputeReasonExplanation: Record<string, string> = {
  fraudulent:
    "The cardholder told their bank they didn't authorize this payment.",
  unrecognized:
    "The account owner doesn't recognize the payment appearing on their account statement.",
  duplicate:
    'The customer says they were charged more than once for the same purchase.',
  product_not_received:
    'The customer says they never received the product or service.',
  product_unacceptable:
    "The customer says the product or service wasn't as described or was defective.",
  subscription_canceled:
    'The customer says they were charged after canceling their subscription.',
  credit_not_processed:
    'The customer says a refund they were owed was never processed.',
}

export const getDisputeReasonExplanation = (reason: string | null): string =>
  (reason ? DisputeReasonExplanation[reason] : undefined) ??
  'The customer disputed this payment with their bank.'
