import { schemas } from '@polar-sh/client'

export const RefundReasonDisplay: Record<schemas['RefundReason'], string> = {
  duplicate: 'Duplicate',
  fraudulent: 'Fraudulent',
  customer_request: 'Customer Request',
  service_disruption: 'Service Disruption',
  satisfaction_guarantee: 'Satisfaction Guarantee',
  dispute_prevention: 'Dispute Prevention',
  tax_refund: 'Tax Refund',
  vat_reverse_charge_correction: 'VAT Reverse Charge Correction',
  other: 'Other',
}
