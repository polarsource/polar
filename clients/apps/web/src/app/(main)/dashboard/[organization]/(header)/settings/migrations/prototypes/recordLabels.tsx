import type { StatusColor } from '@polar-sh/orbit'
import {
  BillingOwner,
  IssueCode,
  SubscriptionCategory,
  SubscriptionStatus,
} from './mockData'

export const TOP_ISSUE_CODES: IssueCode[] = [
  'customer_missing_country',
  'product_exists_in_polar',
  'customer_stripe_id_conflict',
]

export const CATEGORY_LABELS: Record<SubscriptionCategory, string> = {
  clean: 'Ready',
  customer: 'Customer',
  identity: 'Identity',
  product: 'Product',
  payment: 'Payment',
  lifecycle: 'Lifecycle',
  pricing: 'Pricing',
  cutover: 'Cutover',
}

export const RESOLUTION_DOMAIN_LABELS = {
  product: 'Product',
  country: 'Country',
  identity: 'Identity',
} as const

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ready: 'Ready',
  action_required: 'Needs decision',
  blocked: 'Blocked',
  cutover_hold: 'Hold',
}

export const OWNER_LABELS: Record<BillingOwner, string> = {
  polar: 'Polar',
  stripe: 'Stripe',
  unknown: 'Unknown',
}

export function statusColor(status: SubscriptionStatus): StatusColor {
  if (status === 'ready') {
    return 'green'
  }
  if (status === 'action_required') {
    return 'yellow'
  }
  if (status === 'blocked') {
    return 'red'
  }
  return 'blue'
}
