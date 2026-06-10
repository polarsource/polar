import { schemas } from '@polar-sh/client'
import type { StatusColor } from '@polar-sh/orbit'

export const RefundStatusDisplayTitle: Record<schemas['RefundStatus'], string> =
  {
    succeeded: 'Succeeded',
    pending: 'Pending',
    failed: 'Failed',
    canceled: 'Canceled',
  }

export const RefundStatusDisplayColor: Record<
  schemas['RefundStatus'],
  StatusColor
> = {
  succeeded: 'green',
  pending: 'yellow',
  failed: 'red',
  canceled: 'gray',
}

export const RefundReasonDisplay: Record<schemas['RefundReason'], string> = {
  duplicate: 'Duplicate',
  fraudulent: 'Fraudulent',
  customer_request: 'Customer Request',
  service_disruption: 'Service Disruption',
  satisfaction_guarantee: 'Satisfaction Guarantee',
  dispute_prevention: 'Dispute Prevention',
  other: 'Other',
}
