export const CANCELLATION_REASONS = [
  'too_expensive',
  'missing_features',
  'switched_service',
  'unused',
  'customer_service',
  'low_quality',
  'too_complex',
  'other',
] as const

export const REASON_COLORS = {
  too_expensive: '#EF765F',
  missing_features: '#F3AB71',
  switched_service: '#F0C289',
  unused: '#8ED6B9',
  customer_service: '#618BE6',
  low_quality: '#2A459D',
  too_complex: '#EF8EB0',
  other: '#CEC7C7',
} as const

export const REASON_LABELS = {
  too_expensive: 'Too Expensive',
  missing_features: 'Missing Features',
  switched_service: 'Switched Service',
  unused: 'Unused',
  customer_service: 'Customer Service',
  low_quality: 'Low Quality',
  too_complex: 'Too Complex',
  other: 'Other',
} as const

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]
