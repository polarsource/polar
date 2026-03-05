import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { ProductPriceCustom } from '@polar-sh/sdk/models/components/productpricecustom'
import type { ProductPriceFixed } from '@polar-sh/sdk/models/components/productpricefixed'
import type { ProductPriceFree } from '@polar-sh/sdk/models/components/productpricefree'
import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit'
import type { ProductPriceSeatBased } from '@polar-sh/sdk/models/components/productpriceseatbased'
import type { ProductCheckoutPublic } from '../guards'

const now = new Date()

const priceDefaults = {
  id: 'price_1',
  source: 'catalog' as const,
  priceCurrency: 'usd',
  isArchived: false,
  productId: 'prod_1',
  createdAt: now,
  modifiedAt: null,
}

export function createFixedPrice(
  overrides: Partial<ProductPriceFixed> = {},
): ProductPriceFixed {
  return {
    ...priceDefaults,
    amountType: 'fixed',
    priceAmount: 999,
    ...overrides,
  }
}

export function createFreePrice(
  overrides: Partial<ProductPriceFree> = {},
): ProductPriceFree {
  return {
    ...priceDefaults,
    amountType: 'free',
    ...overrides,
  }
}

export function createCustomPrice(
  overrides: Partial<ProductPriceCustom> = {},
): ProductPriceCustom {
  return {
    ...priceDefaults,
    amountType: 'custom',
    minimumAmount: 500,
    maximumAmount: null,
    presetAmount: 1500,
    ...overrides,
  }
}

export function createSeatBasedPrice(
  overrides: Partial<ProductPriceSeatBased> = {},
): ProductPriceSeatBased {
  return {
    ...priceDefaults,
    amountType: 'seat_based',
    seatTiers: {
      tiers: [{ minSeats: 1, maxSeats: null, pricePerSeat: 1000 }],
      minimumSeats: 1,
      maximumSeats: null,
    },
    ...overrides,
  }
}

export function createMeteredPrice(
  overrides: Partial<ProductPriceMeteredUnit> = {},
): ProductPriceMeteredUnit {
  return {
    ...priceDefaults,
    id: 'price_metered_1',
    amountType: 'metered_unit',
    unitAmount: '0.05',
    capAmount: null,
    meterId: 'meter_1',
    meter: { id: 'meter_1', name: 'API Calls' },
    ...overrides,
  }
}

const defaults: ProductCheckoutPublic = {
  // SDK CheckoutPublic required fields
  id: 'checkout_1',
  createdAt: now,
  modifiedAt: null,
  paymentProcessor: 'stripe',
  status: 'open',
  clientSecret: 'cs_test_123',
  url: 'https://checkout.example.com',
  expiresAt: new Date(Date.now() + 3600_000),
  successUrl: 'https://example.com/success',
  returnUrl: null,
  embedOrigin: null,
  amount: 999,
  discountAmount: 0,
  netAmount: 999,
  taxAmount: null,
  totalAmount: 999,
  currency: 'usd',
  allowTrial: null,
  activeTrialInterval: null,
  activeTrialIntervalCount: null,
  trialEnd: null,
  organizationId: 'org_1',
  productId: 'prod_1',
  productPriceId: 'price_1',
  discountId: null,
  allowDiscountCodes: true,
  requireBillingAddress: false,
  isDiscountApplicable: true,
  isFreeProductPrice: false,
  isPaymentRequired: true,
  isPaymentSetupRequired: false,
  isPaymentFormRequired: true,
  customerId: null,
  isBusinessCustomer: false,
  customerName: null,
  customerEmail: null,
  customerIpAddress: null,
  customerBillingName: null,
  customerBillingAddress: null,
  customerTaxId: null,
  paymentProcessorMetadata: {},
  billingAddressFields: {
    country: 'required',
    state: 'optional',
    city: 'optional',
    postalCode: 'optional',
    line1: 'optional',
    line2: 'disabled',
  },
  products: [],
  discount: null,
  organization: {
    id: 'org_1',
    slug: 'test-org',
    name: 'Test Org',
    avatarUrl: null,
    createdAt: now,
    modifiedAt: null,
    prorationBehavior: 'invoice',
    allowCustomerUpdates: true,
  },
  attachedCustomFields: null,

  // ProductCheckoutMixin fields
  product_id: 'prod_1',
  product: {
    id: 'prod_1',
    name: 'Test Product',
    recurringInterval: null,
    recurringIntervalCount: null,
    isRecurring: false,
    trialInterval: null,
    trialIntervalCount: null,
    visibility: 'public',
    prices: [],
    benefits: [],
    medias: [],
    description: null,
    isArchived: false,
    organizationId: 'org_1',
    createdAt: now,
    modifiedAt: null,
  },
  productPrice: createFixedPrice(),
  prices: { prod_1: [] },
} as ProductCheckoutPublic

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
  } as ProductCheckoutPublic
}

/**
 * Create a CheckoutPublic (without the product mixin) for testing.
 */
export function createBaseCheckout(
  overrides: Partial<CheckoutPublic> = {},
): CheckoutPublic {
  return {
    ...defaults,
    ...overrides,
  } as CheckoutPublic
}
