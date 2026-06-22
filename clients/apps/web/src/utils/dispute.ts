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
}

export const DisputeStatusDisplayColor: Record<
  schemas['DisputeStatus'],
  StatusColor
> = {
  prevented: 'green',
  early_warning: 'yellow',
  needs_response: 'yellow',
  under_review: 'blue',
  won: 'green',
  lost: 'red',
}

// Merchant-friendly description of a Stripe dispute reason, phrased to read as
// "the customer disputed this payment, citing <description>".
export const DisputeReasonDescription: Record<string, string> = {
  bank_cannot_process: "a payment their bank couldn't process",
  check_returned: 'a returned check',
  credit_not_processed: 'a refund that was never processed',
  customer_initiated: 'a problem with the charge',
  debit_not_authorized: "a debit they didn't authorize",
  duplicate: 'a duplicate charge',
  fraudulent: 'an unauthorized charge',
  general: 'a problem with the charge',
  incorrect_account_details: 'incorrect account details',
  insufficient_funds: 'insufficient funds',
  product_not_received: 'a product or service they never received',
  product_unacceptable: "a product or service that wasn't as described",
  subscription_canceled: "a subscription they'd canceled",
  unrecognized: "a charge they didn't recognize",
}

export const getDisputeReasonDescription = (reason: string): string =>
  DisputeReasonDescription[reason] ?? reason.replace(/_/g, ' ')
