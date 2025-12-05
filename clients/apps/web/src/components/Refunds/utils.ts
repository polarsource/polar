import { schemas } from '@polar-sh/client'

export const RefundStatusDisplayTitle: Record<schemas['RefundStatus'], string> =
  {
    succeeded: 'Succeeded',
    pending: 'Pending',
    failed: 'Failed',
    canceled: 'Canceled',
  }

export const RefundStatusDisplayColor: Record<schemas['RefundStatus'], string> =
  {
    succeeded: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
    pending: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
    failed: 'bg-red-100 text-red-500 dark:bg-red-950',
    canceled: 'bg-gray-500 text-black dark:text-white dark:bg-polar-500',
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
