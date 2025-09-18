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
  too_expensive: '#ef4444',
  missing_features: '#f97316',
  switched_service: '#eab308',
  unused: '#22c55e',
  customer_service: '#06b6d4',
  low_quality: '#8b5cf6',
  too_complex: '#ec4899',
  other: '#6b7280',
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
