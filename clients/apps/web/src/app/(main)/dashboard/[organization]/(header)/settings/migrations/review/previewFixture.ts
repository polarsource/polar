import { ReviewRow } from './reviewRows'

export const PREVIEW_MIGRATION_ID = '00000000-0000-4000-8000-000000000001'

export const assessmentPreviewRow: ReviewRow = {
  record_id: '00000000-0000-4000-8000-000000000002',
  entity: 'subscriptions',
  source_id: 'sub_1PepyProSmard',
  title: 'smard@nvidia.com',
  subtitle: 'Active',
  product_name: 'Pepy Pro',
  product_source_id: 'prod_PepyPro',
  customer_email: 'smard@nvidia.com',
  customer_name: null,
  customer_source_id: 'cus_SmardNvidia',
  customer_country: null,
  customer_country_hint: null,
  customer_billing_address: null,
  amount: 9000,
  currency: 'usd',
  recurring_interval: 'year',
  recurring_interval_count: 1,
  automatic_tax: false,
  tax_behavior: 'inclusive',
  status: 'importable',
  import_status: 'pending',
  reason:
    "No billing or payment-method country was found. The customer will import, but Polar won't calculate tax until a billing country is added.",
  reason_code: 'customer_missing_country',
  reason_level: 'info',
  conflicting_customer_id: null,
  cutover_status: null,
  cutover_error: null,
  renews_at: '2027-01-17T12:00:00.000Z',
  has_payment_method: true,
  dependencies_imported: true,
}
