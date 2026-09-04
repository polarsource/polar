import type { models, Polar } from '@polar-sh/sdk/2026-04'
import type { User } from 'better-auth'
import { type Mock, vi } from 'vitest'

type PolarClientMocks<T> = T extends (...args: infer Args) => unknown
  ? Mock<(...args: Args) => any>
  : T extends object
    ? { [Key in keyof T]: PolarClientMocks<T[Key]> }
    : T

type MockPolarClient = Polar & PolarClientMocks<Polar>

export const createMockPolarClient = (): MockPolarClient =>
  ({
    products: {
      get: vi.fn().mockResolvedValue({ is_recurring: false, prices: [] }),
      list: vi.fn(),
    },
    checkouts: {
      create: vi.fn(),
      get: vi.fn(),
    },
    customers: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      updateExternal: vi.fn(),
      get: vi.fn(),
      getExternal: vi.fn(),
      getStateExternal: vi.fn(),
      list: vi.fn(),
      members: {
        listExternal: vi.fn(),
        createExternal: vi.fn(),
        deleteExternal: vi.fn(),
        getExternal: vi.fn(),
        updateExternal: vi.fn(),
      },
    },
    customerSessions: {
      create: vi.fn(),
    },
    customerPortal: {
      create: vi.fn(),
      benefitGrants: {
        list: vi.fn(),
      },
      subscriptions: {
        list: vi.fn(),
      },
      orders: {
        list: vi.fn(),
      },
      customerMeters: {
        list: vi.fn(),
      },
    },
    orders: {
      list: vi.fn(),
    },
    subscriptions: {
      get: vi.fn(),
      list: vi.fn().mockResolvedValue({
        items: [],
        pagination: { total_count: 0, max_page: 1 },
      }),
      update: vi.fn(),
    },
    customerSeats: {
      listSeats: vi.fn().mockResolvedValue({
        seats: [],
        available_seats: 0,
        total_seats: 0,
      }),
      assignSeat: vi.fn(),
      revokeSeat: vi.fn(),
    },
    benefits: {
      list: vi.fn(),
    },
    events: {
      ingest: vi.fn(),
    },
    usageRecords: {
      create: vi.fn(),
    },
    meters: {
      list: vi.fn(),
    },
    webhookEndpoints: {
      verify: vi.fn(),
    },
  }) as any

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  emailVerified: false,
  ...overrides,
})

export const createMockBetterAuthContext = (): any => ({
  request: new Request('http://localhost:3000/test'),
  getPlugin: vi.fn().mockReturnValue({
    id: 'organization',
    options: { creatorRole: 'owner' },
  }),
  session: {
    session: {
      id: 'session-123',
      userId: 'user-123',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      token: 'session-token',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: createMockUser(),
  },
  headers: new Headers(),
  body: {},
  method: 'GET' as const,
  path: '/test',
  params: {},
  query: {},
})

export const createMockProduct = () => ({
  id: 'product-123',
  created_at: new Date().toISOString(),
  modified_at: new Date().toISOString(),
  trial_interval: null,
  trial_interval_count: null,
  name: 'Test Product',
  description: 'A test product',
  visibility: 'public' as const,
  recurring_interval: null,
  recurring_interval_count: null,
  meter_interval: null,
  meter_interval_count: null,
  is_recurring: false,
  is_archived: false,
  organization_id: 'org-123',
  metadata: {},
  prices: [],
  benefits: [],
  medias: [],
  attached_custom_fields: [],
})

export const createMockCheckout = () => ({
  id: 'checkout-123',
  url: 'https://polar.sh/checkout/checkout-123',
  customer_id: 'customer-123',
  customer_email: 'test@example.com',
  product_id: 'product-123',
  product_price_id: 'price-123',
  success_url: 'https://example.com/success',
  created_at: new Date().toISOString(),
  modified_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
})

export const createMockCustomer = (
  overrides: Partial<models.Customer> = {},
): models.Customer =>
  ({
    id: 'customer-123',
    type: 'individual',
    email: 'test@example.com',
    email_verified: true,
    name: 'Test Customer',
    billing_name: null,
    billing_address: null,
    tax_id: null,
    organization_id: 'org-123',
    avatar_url: '',
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    external_id: 'external-id-123',
    deleted_at: null,
    first_user_event_at: null,
    metadata: {},
    ...overrides,
  }) as models.Customer
