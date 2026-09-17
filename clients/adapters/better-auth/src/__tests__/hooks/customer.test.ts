import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onAfterUserCreate, onUserUpdate } from '../../hooks/customer'
import { createTestPolarOptions, mockApiError } from '../utils/helpers'
import {
  createMockBetterAuthContext,
  createMockCustomer,
  createMockPolarClient,
  createMockUser,
} from '../utils/mocks'

describe('customer hooks', () => {
  let mockClient: ReturnType<typeof createMockPolarClient>

  beforeEach(() => {
    mockClient = createMockPolarClient()
  })

  describe('onAfterUserCreate', () => {
    it('creates a customer with the user ID in the initial request', async () => {
      const user = createMockUser()
      vi.mocked(mockClient.customers.list).mockResolvedValue({
        items: [],
        pagination: { total_count: 0, max_page: 1 },
      })

      await onAfterUserCreate(createTestPolarOptions({ client: mockClient }))(
        user,
        createMockBetterAuthContext(),
      )

      expect(mockClient.customers.create).toHaveBeenCalledExactlyOnceWith({
        email: user.email,
        name: user.name,
        external_id: user.id,
      })
      expect(mockClient.customers.update).not.toHaveBeenCalled()
    })

    it('rejects a customer linked to another user without reassigning it', async () => {
      vi.mocked(mockClient.customers.list).mockResolvedValue({
        items: [createMockCustomer({ external_id: 'another-user' })],
        pagination: { total_count: 1, max_page: 1 },
      })

      await expect(
        onAfterUserCreate(createTestPolarOptions({ client: mockClient }))(
          createMockUser(),
          createMockBetterAuthContext(),
        ),
      ).rejects.toMatchObject({ status: 'CONFLICT' })
      expect(mockClient.customers.create).not.toHaveBeenCalled()
      expect(mockClient.customers.update).not.toHaveBeenCalled()
    })

    it('claims an unlinked individual customer by setting its external_id', async () => {
      const user = createMockUser({
        id: 'user-1',
        email: 'unlinked@example.com',
      })
      const individualCustomer = createMockCustomer({
        id: 'cust-1',
        type: 'individual',
        email: user.email,
        external_id: null,
      })
      vi.mocked(mockClient.customers.list).mockResolvedValue({
        items: [individualCustomer],
        pagination: { total_count: 1, max_page: 1 },
      })
      vi.mocked(mockClient.customers.update).mockResolvedValue(
        individualCustomer as any,
      )

      await onAfterUserCreate(createTestPolarOptions({ client: mockClient }))(
        user,
        createMockBetterAuthContext(),
      )

      expect(mockClient.customers.update).toHaveBeenCalledWith('cust-1', {
        external_id: 'user-1',
      })
      expect(mockClient.customers.create).not.toHaveBeenCalled()
    })

    it('does not claim a team customer with a null external_id and surfaces a conflict', async () => {
      const user = createMockUser({ id: 'user-1', email: 'team@example.com' })
      vi.mocked(mockClient.customers.list).mockResolvedValue({
        items: [
          createMockCustomer({
            id: 'team-cust',
            type: 'team',
            email: user.email,
            external_id: null,
          }),
        ],
        pagination: { total_count: 1, max_page: 1 },
      })

      await expect(
        onAfterUserCreate(createTestPolarOptions({ client: mockClient }))(
          user,
          createMockBetterAuthContext(),
        ),
      ).rejects.toMatchObject({ status: 'CONFLICT' })
      expect(mockClient.customers.create).not.toHaveBeenCalled()
      expect(mockClient.customers.update).not.toHaveBeenCalled()
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
})
