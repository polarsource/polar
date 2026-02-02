import type { schemas } from '@spaire/client'

export type CustomerPortalOrganization =
  schemas['CustomerSubscription']['product']['organization']

export type CustomerPortalProduct = schemas['CustomerSubscription']['product']

export const organizationFixture = (
  overrides: Partial<CustomerPortalOrganization> = {},
): CustomerPortalOrganization =>
  ({
    id: 'org_test123',
    created_at: '2024-01-01T00:00:00Z',
    modified_at: null,
    name: 'Test Organization',
    slug: 'test-org',
    avatar_url: null,
    proration_behavior: 'invoice',
    allow_customer_updates: true,
    customer_portal_settings: {
      usage: { show: true },
      subscription: { update_seats: true, update_plan: true },
    },
    ...overrides,
  }) satisfies CustomerPortalOrganization as CustomerPortalOrganization

export const productFixture = (
  overrides: Partial<CustomerPortalProduct> = {},
): CustomerPortalProduct =>
  ({
    id: 'product-abc123',
    created_at: '2024-01-01T00:00:00Z',
    modified_at: null,
    name: 'Test Product',
    description: null,
    organization_id: 'org_test123',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    trial_interval: null,
    trial_interval_count: null,
    is_recurring: true,
    is_archived: false,
    prices: [],
    benefits: [],
    medias: [],
    organization: organizationFixture(),
    ...overrides,
  }) satisfies CustomerPortalProduct as CustomerPortalProduct

export const customerFixture = (
  overrides: Partial<schemas['CustomerPortalCustomer']> = {},
): schemas['CustomerPortalCustomer'] => ({
  id: 'customer-abc123',
  created_at: '2024-01-01T00:00:00Z',
  modified_at: null,
  email: 'test@example.com',
  email_verified: true,
  name: 'Test Customer',
  billing_name: null,
  billing_address: null,
  tax_id: null,
  oauth_accounts: {},
  default_payment_method_id: null,
  ...overrides,
})

export const subscriptionFixture = (
  overrides: Partial<schemas['CustomerSubscription']> = {},
): schemas['CustomerSubscription'] =>
  ({
    id: 'subscription-abc123',
    created_at: '2024-01-01T00:00:00Z',
    modified_at: null,
    status: 'active',
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    current_period_start: '2024-01-01T00:00:00Z',
    current_period_end: '2024-02-01T00:00:00Z',
    started_at: '2024-01-01T00:00:00Z',
    ends_at: null,
    trial_start: null,
    trial_end: null,
    customer_id: 'customer-abc123',
    product_id: 'product-abc123',
    discount_id: null,
    customer_cancellation_reason: null,
    customer_cancellation_comment: null,
    checkout_id: null,
    amount: 1000,
    currency: 'usd',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    meters: [],
    product: productFixture(),
    ...overrides,
  }) as schemas['CustomerSubscription']

export const orderFixture = (
  overrides: Partial<schemas['CustomerOrder']> = {},
): schemas['CustomerOrder'] => ({
  id: 'order-abc123',
  created_at: '2024-01-01T00:00:00Z',
  modified_at: null,
  status: 'paid',
  paid: true,
  subtotal_amount: 1000,
  discount_amount: 0,
  net_amount: 1000,
  total_amount: 1000,
  tax_amount: 0,
  applied_balance_amount: 0,
  due_amount: 1000,
  refunded_amount: 0,
  refunded_tax_amount: 0,
  currency: 'usd',
  user_id: 'user-abc123',
  customer_id: 'customer-abc123',
  product_id: 'product-abc123',
  subscription_id: null,
  discount_id: null,
  checkout_id: null,
  billing_reason: 'purchase',
  billing_name: null,
  billing_address: null,
  invoice_number: 'INV-001',
  is_invoice_generated: true,
  items: [],
  description: 'Test order',
  product: productFixture({
    is_recurring: false,
    recurring_interval: null,
    recurring_interval_count: null,
  }),
  subscription: null,
  ...overrides,
})
