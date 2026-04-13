import type { schemas } from '@polar-sh/client'
import type { ProductCheckoutPublic } from '../guards'

const now = new Date()

const priceDefaults = {
  id: 'price_1',
  source: 'catalog' as const,
  price_currency: 'usd',
  tax_behavior: null,
  is_archived: false,
  product_id: 'prod_1',
  created_at: now.toISOString(),
  modified_at: null,
}

export function createFixedPrice(
  overrides: Partial<schemas['ProductPriceFixed']> = {},
): schemas['ProductPriceFixed'] {
  return {
    ...priceDefaults,
    amount_type: 'fixed',
    price_amount: 999,
    ...overrides,
  }
}

export function createFreePrice(
  overrides: Partial<schemas['ProductPriceFree']> = {},
): schemas['ProductPriceFree'] {
  return {
    ...priceDefaults,
    amount_type: 'free',
    ...overrides,
  }
}

export function createCustomPrice(
  overrides: Partial<schemas['ProductPriceCustom']> = {},
): schemas['ProductPriceCustom'] {
  return {
    ...priceDefaults,
    amount_type: 'custom',
    minimum_amount: 500,
    maximum_amount: null,
    preset_amount: 1500,
    ...overrides,
  }
}

export function createSeatBasedPrice(
  overrides: Partial<schemas['ProductPriceSeatBased']> = {},
): schemas['ProductPriceSeatBased'] {
  return {
    ...priceDefaults,
    amount_type: 'seat_based',
    seat_tiers: {
      seat_tier_type: 'volume',
      tiers: [{ min_seats: 1, max_seats: null, price_per_seat: 1000 }],
      minimum_seats: 1,
      maximum_seats: null,
    },
    ...overrides,
  }
}

export function createMeteredPrice(
  overrides: Partial<schemas['ProductPriceMeteredUnit']> = {},
): schemas['ProductPriceMeteredUnit'] {
  return {
    ...priceDefaults,
    id: 'price_metered_1',
    amount_type: 'metered_unit',
    unit_amount: '0.05',
    cap_amount: null,
    meter_id: 'meter_1',
    meter: { id: 'meter_1', name: 'API Calls', unit: 'scalar' },
    ...overrides,
  }
}

const defaults: ProductCheckoutPublic = {
  // SDK CheckoutPublic required fields
  id: 'checkout_1',
  created_at: now.toISOString(),
  modified_at: null,
  payment_processor: 'stripe',
  status: 'open',
  client_secret: 'cs_test_123',
  url: 'https://checkout.example.com',
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  success_url: 'https://example.com/success',
  return_url: null,
  embed_origin: null,
  amount: 999,
  discount_amount: 0,
  net_amount: 999,
  tax_amount: null,
  total_amount: 999,
  currency: 'usd',
  allow_trial: null,
  active_trial_interval: null,
  active_trial_interval_count: null,
  trial_end: null,
  organization_id: 'org_1',
  product_id: 'prod_1',
  product_price_id: 'price_1',
  discount_id: null,
  allow_discount_codes: true,
  require_billing_address: false,
  is_discount_applicable: true,
  is_free_product_price: false,
  is_payment_required: true,
  is_payment_setup_required: false,
  is_payment_form_required: true,
  customer_id: null,
  is_business_customer: false,
  customer_name: null,
  customer_email: null,
  customer_ip_address: null,
  customer_billing_name: null,
  customer_billing_address: null,
  customer_tax_id: null,
  payment_processor_metadata: {},
  billing_address_fields: {
    country: 'required',
    state: 'optional',
    city: 'optional',
    postal_code: 'optional',
    line1: 'optional',
    line2: 'disabled',
  },
  products: [],
  discount: null,
  organization: {
    id: 'org_1',
    slug: 'test-org',
    name: 'Test Org',
    avatar_url: null,
    created_at: now.toISOString(),
    modified_at: null,
    proration_behavior: 'invoice',
    allow_customer_updates: true,
  },
  attached_custom_fields: null,

  // ProductCheckoutMixin fields
  product: {
    id: 'prod_1',
    name: 'Test Product',
    recurring_interval: null,
    recurring_interval_count: null,
    is_recurring: false,
    trial_interval: null,
    trial_interval_count: null,
    visibility: 'public',
    prices: [],
    benefits: [],
    medias: [],
    description: null,
    is_archived: false,
    organization_id: 'org_1',
    created_at: now.toISOString(),
    modified_at: null,
  },
  product_price: createFixedPrice(),
  prices: { prod_1: [] },
} satisfies ProductCheckoutPublic

/**
 * Create a ProductCheckoutPublic for testing.
 * Only override the fields relevant to your test case.
 */
export function createCheckout(
  overrides: Partial<ProductCheckoutPublic> = {},
): ProductCheckoutPublic {
  return {
    ...defaults,
    ...overrides,
  } satisfies ProductCheckoutPublic
}

/**
 * Create a CheckoutPublic (without the product mixin) for testing.
 */
export function createBaseCheckout(
  overrides: Partial<schemas['CheckoutPublic']> = {},
): schemas['CheckoutPublic'] {
  return {
    ...defaults,
    ...overrides,
  } satisfies schemas['CheckoutPublic']
}
