import { schemas } from '@polar-sh/client'

export type MigrationRecord = schemas['MerchantMigrationRecordItem']

export type MappingKind =
  | 'customers'
  | 'products'
  | 'prices'
  | 'discounts'
  | 'subscriptions'

export const MAPPING_KINDS: MappingKind[] = [
  'customers',
  'products',
  'prices',
  'discounts',
  'subscriptions',
]

export type MappingState =
  | 'moved'
  | 'in_polar'
  | 'not_switched'
  | 'left_on_stripe'
  | 'failed'
  | 'not_imported'

export interface MappingRow {
  kind: MappingKind
  stripeId: string
  polarId: string | null
  label: string
  detail: string | null
  state: MappingState
  note: string | null
  // When Polar started billing it: the switch creates the Polar subscription.
  switchedAt: string | null
  record: MigrationRecord
}

export interface PolarSubscriptionRef {
  id: string
  created_at: string
  customer: { id: string }
  product: {
    id: string
    recurring_interval: string | null
    recurring_interval_count: number | null
  }
  metadata: Record<string, unknown>
}

export interface PolarProductRef {
  id: string
  name: string
  recurring_interval: string | null
  recurring_interval_count: number | null
  prices: {
    id: string
    amount_type: string
    price_amount?: number
    price_currency?: string
  }[]
}

export interface PolarCustomerRef {
  id: string
  email?: string | null
}

export interface PolarDiscountRef {
  id: string
  metadata: Record<string, unknown>
}

export interface MappingSources {
  records: Record<MappingKind, MigrationRecord[]>
  subscriptions: PolarSubscriptionRef[]
  customers: PolarCustomerRef[]
  products: PolarProductRef[]
  discounts: PolarDiscountRef[]
}
