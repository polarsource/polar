import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usage } from '../../plugins/usage'
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
  createAuthEndpoint: vi.fn((path, config, handler) => ({
    path,
    config,
    handler,
  })),
  sessionMiddleware: vi.fn(),
}))

const { createAuthEndpoint, sessionMiddleware } = (await vi.importMock(
  'better-auth/api',
)) as any

describe('usage plugin', () => {
  let mockClient: ReturnType<typeof createMockPolarClient>

  beforeEach(() => {
    mockClient = createMockPolarClient()
    vi.clearAllMocks()
  })

  describe('plugin creation', () => {
    it('should create usage plugin with all endpoints', () => {
      const plugin = usage()
      const endpoints = plugin(mockClient)

      expect(Object.keys(endpoints)).toEqual(['meters'])
    })

    it('should create plugin with custom options', () => {
      const options = {
        creditProducts: [{ productId: 'credits-123', slug: 'credits' }],
      }

      const plugin = usage(options)
      const endpoints = plugin(mockClient)

      expect(endpoints).toHaveProperty('meters')
    })

    it('should configure endpoints with correct paths and middleware', () => {
      const plugin = usage()
      plugin(mockClient)

      expect(createAuthEndpoint).toHaveBeenCalledWith(
        '/usage/meters/list',
        expect.objectContaining({
          method: 'GET',
          use: [sessionMiddleware],
          query: expect.any(Object),
        }),
        expect.any(Function),
      )
    })
  })

  describe('meters endpoint', () => {
    let handler: Function

    beforeEach(() => {
      const plugin = usage()
      const endpoints = plugin(mockClient) as any
      handler = endpoints.meters.handler
    })

    it('should list customer meters with pagination', async () => {
      const mockSession = { token: 'session-token-123' }
      const mockMeters = {
        items: [
          {
            id: 'meter-1',
            name: 'API Calls',
            slug: 'api-calls',
            currentBalance: 100,
            limit: 1000,
          },
          {
            id: 'meter-2',
            name: 'Storage',
            slug: 'storage',
            currentBalance: 250,
            limit: 500,
          },
        ],
        pagination: { total: 2, maxPage: 1 },
      }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )
      vi.mocked(
        mockClient.customerPortal.customerMeters.list,
      ).mockResolvedValue(mockMeters)

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

      expect(
        mockClient.customerPortal.customerMeters.list,
      ).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        { accessToken: 'session-token-123' },
      )

      expect(ctx.json).toHaveBeenCalledWith(mockMeters)
    })

    it('should handle missing pagination parameters', async () => {
      const mockSession = { token: 'session-token-123' }
      const mockMeters = { items: [], pagination: { total: 0, maxPage: 1 } }

      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )
      vi.mocked(
        mockClient.customerPortal.customerMeters.list,
      ).mockResolvedValue(mockMeters)

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
        },
        query: {},
        json: vi.fn(),
      }

      await handler(ctx)

      expect(
        mockClient.customerPortal.customerMeters.list,
      ).toHaveBeenCalledWith(
        { page: undefined, limit: undefined },
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

    it('should handle customer session creation failure', async () => {
      vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
        mockApiError(400, 'Customer not found'),
      )

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
          logger: { error: vi.fn() },
        },
      }

      await expect(handler(ctx)).rejects.toThrow('Meters list failed')
      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Polar meters list failed'),
      )
    })

    it('should handle meters list API failure', async () => {
      const mockSession = { token: 'session-token-123' }
      vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
        mockSession,
      )
      vi.mocked(
        mockClient.customerPortal.customerMeters.list,
      ).mockRejectedValue(mockApiError(500, 'Internal server error'))

      const ctx = {
        context: {
          session: { user: { id: 'user-123' } },
          logger: { error: vi.fn() },
        },
      }

      await expect(handler(ctx)).rejects.toThrow('Meters list failed')
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
    })

    it('lists organization meters with a member-scoped session', async () => {
      const endpoints = usage()(mockClient) as any
      const query = endpoints.meters.config.query.parse({
        organizationId: 'organization-123',
      })
      vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
        token: 'session-token-123',
      })
      vi.mocked(
        mockClient.customerPortal.customerMeters.list,
      ).mockResolvedValue({ items: [] })

      await endpoints.meters.handler({ context, query, json: vi.fn() })

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
  })
})
