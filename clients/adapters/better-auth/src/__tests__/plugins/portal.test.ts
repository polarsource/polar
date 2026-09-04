import { beforeEach, describe, expect, it, vi } from 'vitest'
import { portal } from '../../plugins/portal'
import { resolveBillingPrincipal } from '../../principal'
import { mockApiError } from '../utils/helpers'
import { createMockPolarClient } from '../utils/mocks'

vi.mock('../../principal', () => ({
  resolveBillingPrincipal: vi.fn(),
}))

vi.mock('better-auth/api', () => ({
  APIError: class APIError extends Error {
    constructor(
      public code: string,
      public data: { message: string },
    ) {
      super(data.message)
    }
  },
  sessionMiddleware: vi.fn(),
  createAuthEndpoint: vi.fn((path, config, handler) => ({
    path,
    config,
    handler,
  })),
}))

const { APIError, sessionMiddleware, createAuthEndpoint } =
  (await vi.importMock('better-auth/api')) as any

describe('portal plugin', () => {
  let mockClient: ReturnType<typeof createMockPolarClient>

  beforeEach(() => {
    mockClient = createMockPolarClient()
    vi.clearAllMocks()
  })

  describe('plugin creation', () => {
    it('should create portal plugin with all endpoints', () => {
      const plugin = portal()
      const endpoints = plugin(mockClient)

      expect(endpoints).toHaveProperty('portal')
      expect(endpoints).toHaveProperty('state')
      expect(endpoints).toHaveProperty('benefits')
      expect(endpoints).toHaveProperty('subscriptions')
      expect(endpoints).toHaveProperty('orders')
    })

    it('should configure endpoints with correct paths and middleware', () => {
      const plugin = portal()
      plugin(mockClient)

      expect(createAuthEndpoint).toHaveBeenCalledWith(
        '/customer/portal',
        expect.objectContaining({
          method: ['GET', 'POST'],
          use: [sessionMiddleware],
        }),
        expect.any(Function),
      )

      expect(createAuthEndpoint).toHaveBeenCalledWith(
        '/customer/state',
        expect.objectContaining({
          method: 'GET',
          use: [sessionMiddleware],
        }),
        expect.any(Function),
      )
    })
  })

  describe('portal endpoint', () => {
    let handler: Function

    beforeEach(() => {
      const plugin = portal()
      const endpoints = plugin(mockClient) as any
      handler = endpoints.portal.handler
    })

    it('should create customer portal session and return URL', async () => {
      const mockSession = {
        token: 'session-token-123',
        customer_portal_url: 'https://polar.sh/portal/session-123',
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        json: vi.fn(),
      }

      await handler(ctx)

      expect(mockClient.customerSessions.create).toHaveBeenCalledWith({
        external_customer_id: 'user-123',
      })

      expect(ctx.json).toHaveBeenCalledWith({
        url: 'https://polar.sh/portal/session-123',
        redirect: true,
      })
    })

    it('should throw error when user not found', async () => {
      const ctx = {
        context: {
          session: null,
        },
      }

      await expect(handler(ctx)).rejects.toThrow('User not found')
    })

    it('should return redirect: false when body param is false (POST)', async () => {
      const mockSession = {
        token: 'session-token-123',
        customer_portal_url: 'https://polar.sh/portal/session-123',
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        body: { redirect: false },
        json: vi.fn(),
      }

      await handler(ctx)

      expect(ctx.json).toHaveBeenCalledWith({
        url: 'https://polar.sh/portal/session-123',
        redirect: false,
      })
    })

    it('should return redirect: true when body param is true (POST)', async () => {
      const mockSession = {
        token: 'session-token-123',
        customer_portal_url: 'https://polar.sh/portal/session-123',
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        body: { redirect: true },
        json: vi.fn(),
      }

      await handler(ctx)

      expect(ctx.json).toHaveBeenCalledWith({
        url: 'https://polar.sh/portal/session-123',
        redirect: true,
      })
    })

    it('should handle API errors', async () => {
      vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
        mockApiError(400, 'Customer not found'),
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
          logger: { error: vi.fn() },
        },
      }

      await expect(handler(ctx)).rejects.toThrow(
        'Customer portal creation failed',
      )
      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Polar customer portal creation failed'),
      )
    })

    it('should apply theme to portal URL when provided', async () => {
      const plugin = portal({ theme: 'dark' })
      const endpoints = plugin(mockClient) as any
      const themeHandler = endpoints.portal.handler

      const mockSession = {
        token: 'session-token-123',
        customer_portal_url: 'https://polar.sh/portal/session-123',
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        json: vi.fn(),
      }

      await themeHandler(ctx)

      expect(ctx.json).toHaveBeenCalledWith({
        url: 'https://polar.sh/portal/session-123?theme=dark',
        redirect: true,
      })
    })

    it('should support light theme', async () => {
      const plugin = portal({ theme: 'light' })
      const endpoints = plugin(mockClient) as any
      const themeHandler = endpoints.portal.handler

      const mockSession = {
        token: 'session-token-123',
        customer_portal_url: 'https://polar.sh/portal/session-123',
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        json: vi.fn(),
      }

      await themeHandler(ctx)

      expect(ctx.json).toHaveBeenCalledWith({
        url: 'https://polar.sh/portal/session-123?theme=light',
        redirect: true,
      })
    })

    it('should not add theme parameter when not provided', async () => {
      const plugin = portal()
      const endpoints = plugin(mockClient) as any
      const noThemeHandler = endpoints.portal.handler

      const mockSession = {
        token: 'session-token-123',
        customer_portal_url: 'https://polar.sh/portal/session-123',
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        json: vi.fn(),
      }

      await noThemeHandler(ctx)

      expect(ctx.json).toHaveBeenCalledWith({
        url: 'https://polar.sh/portal/session-123',
        redirect: true,
      })
    })

    it('should preserve existing query parameters when adding theme', async () => {
      const plugin = portal({ theme: 'dark' })
      const endpoints = plugin(mockClient) as any
      const themeHandler = endpoints.portal.handler

      const mockSession = {
        token: 'session-token-123',
        customer_portal_url: 'https://polar.sh/portal/session-123?foo=bar',
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        json: vi.fn(),
      }

      await themeHandler(ctx)

      expect(ctx.json).toHaveBeenCalledWith({
        url: 'https://polar.sh/portal/session-123?foo=bar&theme=dark',
        redirect: true,
      })
    })
  })

  describe('state endpoint', () => {
    let handler: Function

    beforeEach(() => {
      const plugin = portal()
      const endpoints = plugin(mockClient) as any
      handler = endpoints.state.handler
    })

    it('should get customer state', async () => {
      const mockState = {
        customer: { id: 'customer-123', email: 'test@example.com' },
        subscriptions: [],
        orders: [],
      }

      vi.mocked(mockClient.customers.getStateExternal).mockResolvedValue(
        mockState,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        json: vi.fn(),
      }

      await handler(ctx)

      expect(mockClient.customers.getStateExternal).toHaveBeenCalledWith(
        'user-123',
      )

      expect(ctx.json).toHaveBeenCalledWith(mockState)
    })

    it('should throw error when user not found', async () => {
      const ctx = {
        context: {
          session: { user: { id: null } },
        },
      }

      await expect(handler(ctx)).rejects.toThrow('User not found')
    })

    it('should handle API errors', async () => {
      vi.mocked(mockClient.customers.getStateExternal).mockRejectedValue(
        mockApiError(404, 'Customer not found'),
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
          logger: { error: vi.fn() },
        },
      }

      await expect(handler(ctx)).rejects.toThrow('Subscriptions list failed')
      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Polar subscriptions list failed'),
      )
    })
  })

  describe('benefits endpoint', () => {
    let handler: Function

    beforeEach(() => {
      const plugin = portal()
      const endpoints = plugin(mockClient) as any
      handler = endpoints.benefits.handler
    })

    it('should list customer benefits with pagination', async () => {
      const mockSession = { token: 'session-token-123' }
      const mockBenefits = {
        items: [
          { id: 'benefit-1', name: 'Premium Feature' },
          { id: 'benefit-2', name: 'Extra Storage' },
        ],
        pagination: { total: 2, maxPage: 1 },
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )
      vi.mocked(mockClient.customerPortal.benefitGrants.list).mockResolvedValue(
        mockBenefits,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        query: { page: 1, limit: 10 },
        json: vi.fn(),
      }

      await handler(ctx)

      expect(mockClient.customerSessions.create).toHaveBeenCalledWith({
        external_customer_id: 'user-123',
      })

      expect(mockClient.customerPortal.benefitGrants.list).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        { accessToken: 'session-token-123' },
      )

      expect(ctx.json).toHaveBeenCalledWith(mockBenefits)
    })

    it('should handle missing query parameters', async () => {
      const mockSession = { token: 'session-token-123' }
      const mockBenefits = { items: [], pagination: { total: 0, maxPage: 1 } }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )
      vi.mocked(mockClient.customerPortal.benefitGrants.list).mockResolvedValue(
        mockBenefits,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        query: undefined,
        json: vi.fn(),
      }

      await handler(ctx)

      expect(mockClient.customerPortal.benefitGrants.list).toHaveBeenCalledWith(
        { page: undefined, limit: undefined },
        { accessToken: 'session-token-123' },
      )
    })

    it('should handle API errors', async () => {
      vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
        mockApiError(400, 'Session creation failed'),
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
          logger: { error: vi.fn() },
        },
      }

      await expect(handler(ctx)).rejects.toThrow('Benefits list failed')
    })
  })

  describe('subscriptions endpoint', () => {
    let handler: Function

    beforeEach(() => {
      const plugin = portal()
      const endpoints = plugin(mockClient) as any
      handler = endpoints.subscriptions.handler
    })

    it('should list subscriptions via customer portal', async () => {
      const mockSession = { token: 'session-token-123' }
      const mockSubscriptions = {
        items: [{ id: 'sub-1', status: 'active' }],
        pagination: { total: 1, maxPage: 1 },
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )
      vi.mocked(mockClient.customerPortal.subscriptions.list).mockResolvedValue(
        mockSubscriptions,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        query: { page: 1, limit: 5, active: true },
        json: vi.fn(),
      }

      await handler(ctx)

      expect(mockClient.customerPortal.subscriptions.list).toHaveBeenCalledWith(
        { page: 1, limit: 5, active: true },
        { accessToken: 'session-token-123' },
      )

      expect(ctx.json).toHaveBeenCalledWith(mockSubscriptions)
    })

    it('should list subscriptions by reference ID', async () => {
      const mockSubscriptions = {
        items: [{ id: 'sub-1', metadata: { referenceId: 'ref-123' } }],
        pagination: { total: 1, maxPage: 1 },
      }

      vi.mocked(mockClient.subscriptions.list).mockResolvedValue(
        mockSubscriptions,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        query: { referenceId: 'ref-123', page: 1, limit: 10 },
        json: vi.fn(),
      }

      await handler(ctx)

      expect(mockClient.subscriptions.list).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        active: undefined,
        metadata: { referenceId: 'ref-123' },
      })

      expect(ctx.json).toHaveBeenCalledWith(mockSubscriptions)
    })

    it('should handle API errors for reference ID lookup', async () => {
      vi.mocked(mockClient.subscriptions.list).mockRejectedValue(
        mockApiError(400, 'Subscription lookup failed'),
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
          logger: { error: vi.fn() },
        },
        query: { referenceId: 'ref-123' },
      }

      await expect(handler(ctx)).rejects.toThrow(
        'Subscriptions list with referenceId failed',
      )
    })

    it('should handle API errors for customer portal lookup', async () => {
      vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
        mockApiError(400, 'Session creation failed'),
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
          logger: { error: vi.fn() },
        },
        query: {},
      }

      await expect(handler(ctx)).rejects.toThrow(
        'Polar subscriptions list failed',
      )
    })
  })

  describe('orders endpoint', () => {
    let handler: Function

    beforeEach(() => {
      const plugin = portal()
      const endpoints = plugin(mockClient) as any
      handler = endpoints.orders.handler
    })

    it('should list customer orders with filters', async () => {
      const mockSession = { token: 'session-token-123' }
      const mockOrders = {
        items: [{ id: 'order-1', productBillingType: 'recurring' }],
        pagination: { total: 1, maxPage: 1 },
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )
      vi.mocked(mockClient.customerPortal.orders.list).mockResolvedValue(
        mockOrders,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        query: { page: 1, limit: 20, productBillingType: 'recurring' },
        json: vi.fn(),
      }

      await handler(ctx)

      expect(mockClient.customerPortal.orders.list).toHaveBeenCalledWith(
        { page: 1, limit: 20, product_billing_type: 'recurring' },
        { accessToken: 'session-token-123' },
      )

      expect(ctx.json).toHaveBeenCalledWith(mockOrders)
    })

    it('should handle one_time billing type filter', async () => {
      const mockSession = { token: 'session-token-123' }
      const mockOrders = { items: [], pagination: { total: 0, maxPage: 1 } }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )
      vi.mocked(mockClient.customerPortal.orders.list).mockResolvedValue(
        mockOrders,
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        query: { productBillingType: 'one_time' },
        json: vi.fn(),
      }

      await handler(ctx)

      expect(mockClient.customerPortal.orders.list).toHaveBeenCalledWith(
        expect.objectContaining({ product_billing_type: 'one_time' }),
        { accessToken: 'session-token-123' },
      )
    })

    it('should throw error when user not found', async () => {
      const ctx = {
        context: {
          session: { user: { id: null } },
        },
      }

      await expect(handler(ctx)).rejects.toThrow('User not found')
    })

    it('should handle API errors', async () => {
      vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
        mockApiError(400, 'Session creation failed'),
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
          logger: { error: vi.fn() },
        },
      }

      await expect(handler(ctx)).rejects.toThrow('Orders list failed')
    })
  })

  describe('organization billing', () => {
    const teamPrincipal = {
      kind: 'team' as const,
      externalCustomerId: 'organization-123',
      externalMemberId: 'user-123',
    }
    const context = { session: { user: { id: 'user-123' } } }

    beforeEach(() => {
      vi.mocked(resolveBillingPrincipal).mockResolvedValue(teamPrincipal)
      vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
        token: 'session-token-123',
        customer_portal_url: 'https://polar.sh/portal/session-123',
      })
    })

    it('selects organizationId from the portal query', async () => {
      const endpoints = portal()(mockClient) as any
      const parsed = endpoints.portal.config.query.parse({
        organizationId: 'organization-123',
      })
      const ctx = { context, query: parsed, json: vi.fn() }

      await endpoints.portal.handler(ctx)

      expect(resolveBillingPrincipal).toHaveBeenCalledWith({
        context,
        session: context.session,
        organizationId: 'organization-123',
        authorization: 'member',
      })
      expect(mockClient.customerSessions.create).toHaveBeenCalledWith({
        external_customer_id: 'organization-123',
        external_member_id: 'user-123',
      })
    })

    it('uses the organization customer for state', async () => {
      const endpoints = portal()(mockClient) as any
      vi.mocked(mockClient.customers.getStateExternal).mockResolvedValue({})

      await endpoints.state.handler({
        context,
        query: { organizationId: 'organization-123' },
        json: vi.fn(),
      })

      expect(mockClient.customers.getStateExternal).toHaveBeenCalledWith(
        'organization-123',
      )
    })

    it.each([
      ['benefits', 'benefitGrants'],
      ['subscriptions', 'subscriptions'],
      ['orders', 'orders'],
    ] as const)(
      'uses a member-scoped session for organization %s',
      async (endpointName, resourceName) => {
        const endpoints = portal()(mockClient) as any
        vi.mocked(
          mockClient.customerPortal[resourceName].list,
        ).mockResolvedValue({
          items: [],
        })

        await endpoints[endpointName].handler({
          context,
          query: { organizationId: 'organization-123' },
          json: vi.fn(),
        })

        expect(mockClient.customerSessions.create).toHaveBeenCalledWith({
          external_customer_id: 'organization-123',
          external_member_id: 'user-123',
        })
      },
    )

    it('rejects organizationId with the legacy referenceId path', async () => {
      const endpoints = portal()(mockClient) as any

      await expect(
        endpoints.subscriptions.handler({
          context,
          query: {
            organizationId: 'organization-123',
            referenceId: 'reference-123',
          },
        }),
      ).rejects.toThrow('organizationId cannot be combined with referenceId')
      expect(mockClient.subscriptions.list).not.toHaveBeenCalled()
      expect(mockClient.customerSessions.create).not.toHaveBeenCalled()
    })

    it('rejects a non-member before calling Polar', async () => {
      const endpoints = portal()(mockClient) as any
      vi.mocked(resolveBillingPrincipal).mockRejectedValue(
        new APIError('FORBIDDEN', { message: 'Not a member' }),
      )

      await expect(
        endpoints.state.handler({
          context,
          query: { organizationId: 'organization-123' },
        }),
      ).rejects.toThrow('Not a member')
      expect(mockClient.customers.getStateExternal).not.toHaveBeenCalled()
    })
  })
})
