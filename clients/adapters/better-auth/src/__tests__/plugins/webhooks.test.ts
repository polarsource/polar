import { beforeEach, describe, expect, it, vi } from 'vitest'
import { webhooks } from '../../plugins/webhooks'
import { createMockPolarClient } from '../utils/mocks'

vi.mock('@polar-sh/adapter-utils', () => ({
  handleWebhookPayload: vi.fn(),
}))

vi.mock('@polar-sh/sdk/webhooks', () => ({
  validateEvent: vi.fn(),
}))

vi.mock('better-auth/api', () => ({
  APIError: class APIError extends Error {
    constructor(
      public code: string,
      public data?: { message: string },
    ) {
      super(data?.message || code)
    }
  },
  createAuthEndpoint: vi.fn((path, config, handler) => ({
    path,
    config,
    handler,
  })),
}))

const { handleWebhookPayload } = (await vi.importMock(
  '@polar-sh/adapter-utils',
)) as any
const { validateEvent } = (await vi.importMock('@polar-sh/sdk/webhooks')) as any
const { APIError, createAuthEndpoint } = (await vi.importMock(
  'better-auth/api',
)) as any

describe('webhooks plugin', () => {
  let mockClient: ReturnType<typeof createMockPolarClient>

  beforeEach(() => {
    mockClient = createMockPolarClient()
    vi.clearAllMocks()
  })

  describe('plugin creation', () => {
    it('should create webhooks plugin with minimal options', () => {
      const options = {
        secret: 'test-secret',
      }

      const plugin = webhooks(options)
      const endpoints = plugin(mockClient)

      expect(endpoints).toHaveProperty('polarWebhooks')
    })

    it('should create webhooks plugin with all handlers', () => {
      const options = {
        secret: 'test-secret',
        onPayload: vi.fn(),
        onCheckoutCreated: vi.fn(),
        onCheckoutUpdated: vi.fn(),
        onOrderCreated: vi.fn(),
        onOrderPaid: vi.fn(),
        onOrderRefunded: vi.fn(),
        onSubscriptionCreated: vi.fn(),
        onSubscriptionUpdated: vi.fn(),
        onSubscriptionActive: vi.fn(),
        onSubscriptionCanceled: vi.fn(),
        onCustomerCreated: vi.fn(),
        onCustomerUpdated: vi.fn(),
        onCustomerSeatAssigned: vi.fn(),
        onCustomerSeatClaimed: vi.fn(),
        onCustomerSeatRevoked: vi.fn(),
        onMemberCreated: vi.fn(),
        onMemberUpdated: vi.fn(),
        onMemberDeleted: vi.fn(),
      }

      const plugin = webhooks(options)
      const endpoints = plugin(mockClient)

      expect(endpoints).toHaveProperty('polarWebhooks')
    })

    it('should configure endpoint with correct path and options', () => {
      const options = { secret: 'test-secret' }
      const plugin = webhooks(options)
      plugin(mockClient)

      expect(createAuthEndpoint).toHaveBeenCalledWith(
        '/polar/webhooks',
        expect.objectContaining({
          method: 'POST',
          metadata: { isAction: false },
          cloneRequest: true,
        }),
        expect.any(Function),
      )
    })
  })

  describe('webhook endpoint handler', () => {
    let handler: Function
    let mockRequest: Request

    beforeEach(() => {
      const options = {
        secret: 'test-webhook-secret',
        onCheckoutCreated: vi.fn(),
        onOrderPaid: vi.fn(),
      }

      const plugin = webhooks(options)
      const endpoints = plugin(mockClient)
      handler = endpoints.polarWebhooks.handler

      // Create a mock request with proper headers
      const headers = new Headers({
        'webhook-id': 'wh_123',
        'webhook-timestamp': '1234567890',
        'webhook-signature': 'v1,signature123',
      })

      mockRequest = {
        headers,
        text: vi
          .fn()
          .mockResolvedValue('{"type": "checkout.created", "data": {}}'),
        body: '{"type": "checkout.created", "data": {}}',
      } as any
    })

    it('should process valid webhook successfully', async () => {
      const mockEvent = {
        type: 'checkout.created',
        data: { id: 'checkout-123' },
      }

      vi.mocked(validateEvent).mockReturnValue(mockEvent)
      vi.mocked(handleWebhookPayload).mockResolvedValue(undefined)

      const ctx = {
        request: mockRequest,
        context: {
          logger: { error: vi.fn() },
        },
        json: vi.fn().mockReturnValue({ received: true }),
      }

      await handler(ctx)

      expect(validateEvent).toHaveBeenCalledWith(
        '{"type": "checkout.created", "data": {}}',
        {
          'webhook-id': 'wh_123',
          'webhook-timestamp': '1234567890',
          'webhook-signature': 'v1,signature123',
        },
        'test-webhook-secret',
      )

      expect(handleWebhookPayload).toHaveBeenCalledWith(
        mockEvent,
        expect.objectContaining({
          webhookSecret: 'test-webhook-secret',
        }),
      )

      expect(ctx.json).toHaveBeenCalledWith({ received: true })
    })

    it('should throw error when request body is missing', async () => {
      const ctx = {
        request: { body: null },
        context: { logger: { error: vi.fn() } },
      }

      await expect(handler(ctx)).rejects.toThrow()
    })

    it('should throw error when webhook secret is missing', async () => {
      const options = { secret: '' }
      const plugin = webhooks(options)
      const endpoints = plugin(mockClient)
      const noSecretHandler = endpoints.polarWebhooks.handler

      const ctx = {
        request: mockRequest,
        context: { logger: { error: vi.fn() } },
      }

      await expect(noSecretHandler(ctx)).rejects.toThrow(
        'Polar webhook secret not found',
      )
    })

    it('should handle invalid webhook signature', async () => {
      vi.mocked(validateEvent).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const ctx = {
        request: mockRequest,
        context: { logger: { error: vi.fn() } },
      }

      await expect(handler(ctx)).rejects.toThrow(
        'Webhook Error: Invalid signature',
      )
      expect(ctx.context.logger.error).toHaveBeenCalledWith('Invalid signature')
    })

    it('should handle missing webhook headers', async () => {
      const invalidRequest = {
        headers: new Headers({}),
        text: vi.fn().mockResolvedValue('{"type": "test"}'),
        body: '{"type": "test"}',
      } as any

      vi.mocked(validateEvent).mockImplementation(() => {
        throw new Error('Missing required headers')
      })

      const ctx = {
        request: invalidRequest,
        context: { logger: { error: vi.fn() } },
      }

      await expect(handler(ctx)).rejects.toThrow(
        'Webhook Error: Missing required headers',
      )
    })

    it('should handle webhook payload processing errors', async () => {
      const mockEvent = { type: 'checkout.created', data: {} }
      vi.mocked(validateEvent).mockReturnValue(mockEvent)
      vi.mocked(handleWebhookPayload).mockRejectedValue(
        new Error('Handler processing failed'),
      )

      const ctx = {
        request: mockRequest,
        context: { logger: { error: vi.fn() } },
      }

      await expect(handler(ctx)).rejects.toThrow(
        'Webhook error: See server logs for more information.',
      )
      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        'Polar webhook failed. Error: Handler processing failed',
      )
    })

    it('should handle non-Error webhook payload failures', async () => {
      const mockEvent = { type: 'checkout.created', data: {} }
      vi.mocked(validateEvent).mockReturnValue(mockEvent)
      vi.mocked(handleWebhookPayload).mockRejectedValue('Unknown error')

      const ctx = {
        request: mockRequest,
        context: { logger: { error: vi.fn() } },
      }

      await expect(handler(ctx)).rejects.toThrow(
        'Webhook error: See server logs for more information.',
      )
      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        'Polar webhook failed. Error: Unknown error',
      )
    })

    it('should handle non-Error validation failures', async () => {
      vi.mocked(validateEvent).mockImplementation(() => {
        throw 'Unknown validation error'
      })

      const ctx = {
        request: mockRequest,
        context: { logger: { error: vi.fn() } },
      }

      await expect(handler(ctx)).rejects.toThrow(
        'Webhook Error: Unknown validation error',
      )
    })

    it('should pass all event handlers to handleWebhookPayload', async () => {
      const mockHandlers = {
        secret: 'test-secret',
        onPayload: vi.fn(),
        onCheckoutCreated: vi.fn(),
        onOrderPaid: vi.fn(),
        onSubscriptionActive: vi.fn(),
        onCustomerSeatAssigned: vi.fn(),
        onCustomerSeatClaimed: vi.fn(),
        onCustomerSeatRevoked: vi.fn(),
        onMemberCreated: vi.fn(),
        onMemberUpdated: vi.fn(),
        onMemberDeleted: vi.fn(),
      }

      const plugin = webhooks(mockHandlers)
      const endpoints = plugin(mockClient)
      const handlerWithAllOptions = endpoints.polarWebhooks.handler

      const mockEvent = { type: 'checkout.created', data: {} }
      vi.mocked(validateEvent).mockReturnValue(mockEvent)
      vi.mocked(handleWebhookPayload).mockResolvedValue(undefined)

      const ctx = {
        request: mockRequest,
        context: { logger: { error: vi.fn() } },
        json: vi.fn().mockReturnValue({ received: true }),
      }

      await handlerWithAllOptions(ctx)

      expect(handleWebhookPayload).toHaveBeenCalledWith(
        mockEvent,
        expect.objectContaining({
          webhookSecret: 'test-secret',
          onPayload: mockHandlers.onPayload,
          onCheckoutCreated: mockHandlers.onCheckoutCreated,
          onOrderPaid: mockHandlers.onOrderPaid,
          onSubscriptionActive: mockHandlers.onSubscriptionActive,
          onCustomerSeatAssigned: mockHandlers.onCustomerSeatAssigned,
          onCustomerSeatClaimed: mockHandlers.onCustomerSeatClaimed,
          onCustomerSeatRevoked: mockHandlers.onCustomerSeatRevoked,
          onMemberCreated: mockHandlers.onMemberCreated,
          onMemberUpdated: mockHandlers.onMemberUpdated,
          onMemberDeleted: mockHandlers.onMemberDeleted,
        }),
      )
    })

    it('should handle different webhook event types', async () => {
      const testCases = [
        { type: 'checkout.created', data: { id: 'checkout-123' } },
        { type: 'order.paid', data: { id: 'order-456' } },
        { type: 'subscription.active', data: { id: 'sub-789' } },
        { type: 'customer.created', data: { id: 'customer-abc' } },
      ]

      for (const mockEvent of testCases) {
        vi.mocked(validateEvent).mockReturnValue(mockEvent)
        vi.mocked(handleWebhookPayload).mockResolvedValue(undefined)

        const ctx = {
          request: mockRequest,
          context: { logger: { error: vi.fn() } },
          json: vi.fn().mockReturnValue({ received: true }),
        }

        await handler(ctx)

        expect(handleWebhookPayload).toHaveBeenCalledWith(
          mockEvent,
          expect.any(Object),
        )
      }
    })

    it('should extract headers correctly from request', async () => {
      const customHeaders = new Headers({
        'webhook-id': 'custom-id-456',
        'webhook-timestamp': '9876543210',
        'webhook-signature': 'v1,custom-signature',
      })

      const customRequest = {
        headers: customHeaders,
        text: vi.fn().mockResolvedValue('{"type": "test"}'),
        body: '{"type": "test"}',
      } as any

      const mockEvent = { type: 'test', data: {} }
      vi.mocked(validateEvent).mockReturnValue(mockEvent)
      vi.mocked(handleWebhookPayload).mockResolvedValue(undefined)

      const ctx = {
        request: customRequest,
        context: { logger: { error: vi.fn() } },
        json: vi.fn().mockReturnValue({ received: true }),
      }

      await handler(ctx)

      expect(validateEvent).toHaveBeenCalledWith(
        '{"type": "test"}',
        {
          'webhook-id': 'custom-id-456',
          'webhook-timestamp': '9876543210',
          'webhook-signature': 'v1,custom-signature',
        },
        'test-webhook-secret',
      )
    })
  })
})
