import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  onAfterUserCreate,
  onBeforeUserCreate,
  onUserDelete,
  onUserUpdate,
} from '../../hooks/customer'
import { createTestPolarOptions, mockApiError } from '../utils/helpers'
import {
  createMockCustomer,
  createMockPolarClient,
  createMockUser,
} from '../utils/mocks'

vi.mock('better-auth/api', () => ({
  APIError: class APIError extends Error {
    constructor(
      public code: string,
      public data: { message: string },
    ) {
      super(data.message)
    }
  },
}))

describe('customer hooks', () => {
  let mockClient: ReturnType<typeof createMockPolarClient>

  beforeEach(() => {
    mockClient = createMockPolarClient()
    vi.mocked(mockClient.customers.list).mockResolvedValue({
      items: [],
      pagination: { total_count: 0, max_page: 1 },
    })
    vi.mocked(mockClient.customers.create).mockResolvedValue(
      createMockCustomer(),
    )
    vi.clearAllMocks()
    // Mock console.log to avoid test output noise
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('onBeforeUserCreate', () => {
    it('should create customer when createCustomerOnSignUp is enabled', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      })

      const mockCustomer = createMockCustomer()

      vi.mocked(mockClient.customers.create).mockResolvedValue(mockCustomer)

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onBeforeUserCreate(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
      })
    })

    it('should not create customer when customer already exists', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      })

      const mockCustomer = createMockCustomer()

      vi.mocked(mockClient.customers.list).mockResolvedValue({
        items: [mockCustomer],
        pagination: { total_count: 1, max_page: 1 },
      })

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onBeforeUserCreate(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.create).not.toHaveBeenCalled()
    })

    it('should use custom getCustomerCreateParams when provided', async () => {
      const mockGetCustomerCreateParams = vi.fn().mockResolvedValue({
        metadata: { source: 'website', plan: 'premium' },
      })

      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
        getCustomerCreateParams: mockGetCustomerCreateParams,
      })

      const mockUser = createMockUser()
      const mockCustomer = createMockCustomer()

      vi.mocked(mockClient.customers.create).mockResolvedValue(mockCustomer)

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onBeforeUserCreate(options)

      await hook(mockUser, ctx)

      expect(mockGetCustomerCreateParams).toHaveBeenCalledWith({
        user: mockUser,
      })

      expect(mockClient.customers.create).toHaveBeenCalledWith({
        email: mockUser.email,
        name: mockUser.name,
        metadata: { source: 'website', plan: 'premium' },
      })
    })

    it('should not create customer when createCustomerOnSignUp is disabled', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: false,
      })

      const mockUser = createMockUser()
      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onBeforeUserCreate(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.create).not.toHaveBeenCalled()
    })

    it('should not create customer when context is missing', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()
      const hook = onBeforeUserCreate(options)

      await hook(mockUser, null)

      expect(mockClient.customers.create).not.toHaveBeenCalled()
    })

    it('should handle API errors during customer creation', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()

      vi.mocked(mockClient.customers.create).mockRejectedValue(
        mockApiError(500, 'Internal server error'),
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onBeforeUserCreate(options)

      await expect(hook(mockUser, ctx)).rejects.toThrow(
        'Polar customer creation failed. Error: Internal server error',
      )
    })

    it('should handle non-Error exceptions', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()

      vi.mocked(mockClient.customers.create).mockRejectedValue('Unknown error')

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onBeforeUserCreate(options)

      await expect(hook(mockUser, ctx)).rejects.toThrow(
        'Polar customer creation failed. Error: Unknown error',
      )
    })

    it('should throw error when user email is missing', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({ email: undefined })
      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onBeforeUserCreate(options)

      await expect(hook(mockUser, ctx)).rejects.toThrow(
        'An associated email is required',
      )

      expect(mockClient.customers.create).not.toHaveBeenCalled()
    })
  })

  describe('onAfterUserCreate', () => {
    it('should update existing customer without external ID', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      })

      const existingCustomer = {
        ...createMockCustomer(),
        id: 'customer-456',
        external_id: null,
      }

      vi.mocked(mockClient.customers.list).mockResolvedValue({
        items: [existingCustomer],
        pagination: { total_count: 1, max_page: 1 },
      })

      vi.mocked(mockClient.customers.update).mockResolvedValue(existingCustomer)

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onAfterUserCreate(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.list).toHaveBeenCalledWith({
        email: 'test@example.com',
      })

      expect(mockClient.customers.update).toHaveBeenCalledWith('customer-456', {
        external_id: 'user-123',
      })
    })

    it('should update existing customer with different external ID', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      })

      const existingCustomer = {
        ...createMockCustomer(),
        id: 'customer-456',
        external_id: 'different-user-id',
      }

      vi.mocked(mockClient.customers.list).mockResolvedValue({
        items: [existingCustomer],
        pagination: { total_count: 1, max_page: 1 },
      })

      vi.mocked(mockClient.customers.update).mockResolvedValue(existingCustomer)

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onAfterUserCreate(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.update).toHaveBeenCalledWith('customer-456', {
        external_id: 'user-123',
      })
    })

    it('should not update existing customer with same external ID', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      })

      const existingCustomer = {
        ...createMockCustomer(),
        id: 'customer-456',
        external_id: 'user-123',
      }

      vi.mocked(mockClient.customers.list).mockResolvedValue({
        items: [existingCustomer],
        pagination: { total_count: 1, max_page: 1 },
      })

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onAfterUserCreate(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.update).not.toHaveBeenCalled()
    })

    it('should not update customer when createCustomerOnSignUp is disabled', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: false,
      })

      const mockUser = createMockUser()
      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onAfterUserCreate(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.list).not.toHaveBeenCalled()
      expect(mockClient.customers.update).not.toHaveBeenCalled()
    })

    it('should not update customer when context is missing', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()
      const hook = onAfterUserCreate(options)

      await hook(mockUser, null)

      expect(mockClient.customers.list).not.toHaveBeenCalled()
      expect(mockClient.customers.update).not.toHaveBeenCalled()
    })

    it('should handle API errors during customer linking', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()

      vi.mocked(mockClient.customers.list).mockRejectedValue(
        mockApiError(500, 'Internal server error'),
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onAfterUserCreate(options)

      await expect(hook(mockUser, ctx)).rejects.toThrow(
        'Polar customer creation failed. Error: Internal server error',
      )
    })

    it('should handle non-Error exceptions during customer linking', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()

      vi.mocked(mockClient.customers.list).mockRejectedValue('Unknown error')

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onAfterUserCreate(options)

      await expect(hook(mockUser, ctx)).rejects.toThrow(
        'Polar customer creation failed. Error: Unknown error',
      )
    })
  })

  describe('onUserUpdate', () => {
    it('should update customer when createCustomerOnSignUp is enabled', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'updated@example.com',
        name: 'Updated User',
      })

      const mockCustomer = createMockCustomer()
      vi.mocked(mockClient.customers.updateExternal).mockResolvedValue(
        mockCustomer,
      )

      const ctx = {
        context: { logger: { error: vi.fn() } },
      } as any

      const hook = onUserUpdate(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.updateExternal).toHaveBeenCalledWith(
        'user-123',
        {
          email: 'updated@example.com',
          name: 'Updated User',
        },
      )
    })

    it('should not update customer when createCustomerOnSignUp is disabled', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: false,
      })

      const mockUser = createMockUser()
      const ctx = {
        context: { logger: { error: vi.fn() } },
      } as any

      const hook = onUserUpdate(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.updateExternal).not.toHaveBeenCalled()
    })

    it('should not update customer when context is missing', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()
      const hook = onUserUpdate(options)

      await hook(mockUser, null)

      expect(mockClient.customers.updateExternal).not.toHaveBeenCalled()
    })

    it('should handle API errors during customer update', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()

      vi.mocked(mockClient.customers.updateExternal).mockRejectedValue(
        mockApiError(404, 'Customer not found'),
      )

      const ctx = {
        context: { logger: { error: vi.fn() } },
      } as any

      const hook = onUserUpdate(options)

      // Should not throw, just log the error
      await hook(mockUser, ctx)

      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        'Polar customer update failed. Error: Customer not found',
      )
    })

    it('should handle non-Error exceptions during update', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()

      vi.mocked(mockClient.customers.updateExternal).mockRejectedValue(
        'Unknown error',
      )

      const ctx = {
        context: { logger: { error: vi.fn() } },
      } as any

      const hook = onUserUpdate(options)

      await hook(mockUser, ctx)

      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        'Polar customer update failed. Error: Unknown error',
      )
    })

    it('should handle network timeouts gracefully', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()

      vi.mocked(mockClient.customers.updateExternal).mockRejectedValue(
        new Error('Network timeout'),
      )

      const ctx = {
        context: { logger: { error: vi.fn() } },
      } as any

      const hook = onUserUpdate(options)

      await hook(mockUser, ctx)

      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        'Polar customer update failed. Error: Network timeout',
      )
    })
  })

  describe('onUserDelete', () => {
    it('should delete the customer by external ID when createCustomerOnSignUp is enabled', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(mockClient.customers.deleteExternal).mockResolvedValue(
        undefined,
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onUserDelete(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.deleteExternal).toHaveBeenCalledWith({
        externalId: 'user-123',
      })
      expect(mockClient.customers.list).not.toHaveBeenCalled()
      expect(mockClient.customers.delete).not.toHaveBeenCalled()
    })

    it('transient sync failure (stale email, no colliding customer): should delete via externalId, not list/delete by email', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      // user.email has moved to 'new@example.com' but Customer A is still
      // stored in Polar with email='old@example.com'. A list-by-email lookup
      // (the buggy path) would return empty here.
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'new@example.com',
      })

      vi.mocked(mockClient.customers.list).mockResolvedValue({
        result: {
          items: [],
          pagination: { totalCount: 0, maxPage: 1 },
        },
        next: vi.fn(),
        [Symbol.asyncIterator]: vi.fn(),
      })
      vi.mocked(mockClient.customers.deleteExternal).mockResolvedValue(
        undefined,
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onUserDelete(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.deleteExternal).toHaveBeenCalledWith({
        externalId: 'user-123',
      })
      expect(mockClient.customers.list).not.toHaveBeenCalled()
      expect(mockClient.customers.delete).not.toHaveBeenCalled()
    })

    it('422 collision (stale email, colliding customer holds the new email): should delete Customer A, leave Customer B untouched', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      // Customer A: externalId='user-123', email='old@example.com' (still).
      // Customer B: externalId=undefined, email='new@example.com' (colliding).
      // A list-by-email lookup (the buggy path) would return Customer B and
      // delete the wrong customer.
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'new@example.com',
      })

      const collidingCustomer = {
        ...createMockCustomer(),
        id: 'cust-B',
        email: 'new@example.com',
        externalId: undefined,
      }

      vi.mocked(mockClient.customers.list).mockResolvedValue({
        result: {
          items: [collidingCustomer],
          pagination: { totalCount: 1, maxPage: 1 },
        },
        next: vi.fn(),
        [Symbol.asyncIterator]: vi.fn(),
      })
      vi.mocked(mockClient.customers.delete).mockResolvedValue(undefined)
      vi.mocked(mockClient.customers.deleteExternal).mockResolvedValue(
        undefined,
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onUserDelete(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.deleteExternal).toHaveBeenCalledWith({
        externalId: 'user-123',
      })
      expect(mockClient.customers.delete).not.toHaveBeenCalled()
      expect(mockClient.customers.list).not.toHaveBeenCalled()
    })

    it('should delete via externalId even when user.email is missing', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({ id: 'user-123', email: undefined })

      vi.mocked(mockClient.customers.deleteExternal).mockResolvedValue(
        undefined,
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onUserDelete(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.deleteExternal).toHaveBeenCalledWith({
        externalId: 'user-123',
      })
    })

    it('should not delete when createCustomerOnSignUp is disabled', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: false,
      })

      const mockUser = createMockUser()
      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onUserDelete(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.deleteExternal).not.toHaveBeenCalled()
      expect(mockClient.customers.list).not.toHaveBeenCalled()
      expect(mockClient.customers.delete).not.toHaveBeenCalled()
    })

    it('should not delete when context is missing', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()
      const hook = onUserDelete(options)

      await hook(mockUser, null)

      expect(mockClient.customers.deleteExternal).not.toHaveBeenCalled()
      expect(mockClient.customers.list).not.toHaveBeenCalled()
      expect(mockClient.customers.delete).not.toHaveBeenCalled()
    })

    it('should skip anonymous users', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({ isAnonymous: true } as any)
      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onUserDelete(options)

      await hook(mockUser, ctx)

      expect(mockClient.customers.deleteExternal).not.toHaveBeenCalled()
      expect(mockClient.customers.list).not.toHaveBeenCalled()
      expect(mockClient.customers.delete).not.toHaveBeenCalled()
    })

    it('should not throw when deleteExternal rejects with an Error, only logs', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()

      vi.mocked(mockClient.customers.deleteExternal).mockRejectedValue(
        mockApiError(404, 'Customer not found'),
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onUserDelete(options)

      await expect(hook(mockUser, ctx)).resolves.toBeUndefined()

      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        'Polar customer delete failed. Error: Customer not found',
      )
    })

    it('should not throw when deleteExternal rejects with a non-Error, only logs', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser()

      vi.mocked(mockClient.customers.deleteExternal).mockRejectedValue(
        'Unknown error',
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any
      const hook = onUserDelete(options)

      await expect(hook(mockUser, ctx)).resolves.toBeUndefined()

      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        'Polar customer delete failed. Error: Unknown error',
      )
    })
  })

  describe('email-change-then-delete sequence (cross-hook bug)', () => {
    it('onUserUpdate swallows a 422, then onUserDelete deletes the correct customer via externalId', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'new@example.com',
      })

      // 1. User changes email in Better Auth: onUserUpdate fires. Customer A
      //    is still stored with email='old@example.com'; the sync to
      //    'new@example.com' collides with Customer B and Polar returns 422.
      //    onUserUpdate swallows the error (by design) and leaves Customer A's
      //    email stale.
      vi.mocked(mockClient.customers.updateExternal).mockRejectedValue(
        mockApiError(422, 'A customer with this email address already exists.'),
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any

      await onUserUpdate(options)(mockUser, ctx)

      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        'Polar customer update failed. Error: A customer with this email address already exists.',
      )

      // 2. Account later deleted: onUserDelete fires with user.email='new@example.com'.
      //    A list-by-email lookup (the buggy path) would return Customer B and
      //    delete the wrong customer. The fix keys off externalId instead.
      const collidingCustomer = {
        ...createMockCustomer(),
        id: 'cust-B',
        email: 'new@example.com',
        externalId: undefined,
      }
      vi.mocked(mockClient.customers.list).mockResolvedValue({
        result: {
          items: [collidingCustomer],
          pagination: { totalCount: 1, maxPage: 1 },
        },
        next: vi.fn(),
        [Symbol.asyncIterator]: vi.fn(),
      })
      vi.mocked(mockClient.customers.delete).mockResolvedValue(undefined)
      vi.mocked(mockClient.customers.deleteExternal).mockResolvedValue(
        undefined,
      )

      await onUserDelete(options)(mockUser, ctx)

      expect(mockClient.customers.deleteExternal).toHaveBeenCalledWith({
        externalId: 'user-123',
      })
      expect(mockClient.customers.delete).not.toHaveBeenCalled()
      expect(mockClient.customers.list).not.toHaveBeenCalled()
    })

    it('onUserUpdate swallows a transient failure, then onUserDelete deletes the correct customer via externalId', async () => {
      const options = createTestPolarOptions({
        client: mockClient,
        createCustomerOnSignUp: true,
      })

      const mockUser = createMockUser({
        id: 'user-123',
        email: 'new@example.com',
      })

      // 1. onUserUpdate fails transiently (network/5xx); error is swallowed.
      vi.mocked(mockClient.customers.updateExternal).mockRejectedValue(
        new Error('Network timeout'),
      )

      const ctx = { context: { logger: { error: vi.fn() } } } as any

      await onUserUpdate(options)(mockUser, ctx)

      expect(ctx.context.logger.error).toHaveBeenCalledWith(
        'Polar customer update failed. Error: Network timeout',
      )

      // 2. onUserDelete: the buggy list-by-email path would return empty
      //    (no Polar customer holds the new email) and silently miss. The fix
      //    keys off externalId and deletes Customer A.
      vi.mocked(mockClient.customers.list).mockResolvedValue({
        result: {
          items: [],
          pagination: { totalCount: 0, maxPage: 1 },
        },
        next: vi.fn(),
        [Symbol.asyncIterator]: vi.fn(),
      })
      vi.mocked(mockClient.customers.deleteExternal).mockResolvedValue(
        undefined,
      )

      await onUserDelete(options)(mockUser, ctx)

      expect(mockClient.customers.deleteExternal).toHaveBeenCalledWith({
        externalId: 'user-123',
      })
      expect(mockClient.customers.delete).not.toHaveBeenCalled()
      expect(mockClient.customers.list).not.toHaveBeenCalled()
    })
  })
})
