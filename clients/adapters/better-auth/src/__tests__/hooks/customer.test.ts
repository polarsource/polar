import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext, User } from 'better-auth'
import {
  installUserDeletePrecondition,
  onAfterUserCreate,
  onUserUpdate,
} from '../../hooks/customer'
import { assertUserDeletionSoleCreatorInvariant } from '../../organization/lifecycle'
import { createTestPolarOptions, mockApiError } from '../utils/helpers'
import {
  createMockBetterAuthContext,
  createMockCustomer,
  createMockPolarClient,
  createMockUser,
} from '../utils/mocks'

vi.mock('../../organization/lifecycle', () => ({
  assertUserDeletionSoleCreatorInvariant: vi.fn(),
  synchronizeUserDeletionMemberships: vi.fn(),
  synchronizeUserOrganizationProfiles: vi.fn(),
}))

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

describe('installUserDeletePrecondition', () => {
  let mockClient: ReturnType<typeof createMockPolarClient>

  beforeEach(() => {
    mockClient = createMockPolarClient()
    vi.clearAllMocks()
  })

  const createMockCtx = (overrides?: {
    beforeDelete?: (user: User, request?: Request) => Promise<void>
    hasDeleteUser?: boolean
  }): AuthContext => {
    const deleteUser =
      overrides?.hasDeleteUser === false
        ? undefined
        : {
            enabled: true as const,
            ...(overrides?.beforeDelete
              ? { beforeDelete: overrides.beforeDelete }
              : {}),
          }
    return {
      ...createMockBetterAuthContext(),
      options: { user: deleteUser ? { deleteUser } : undefined },
    } as unknown as AuthContext
  }

  it('no-ops when organization sync is disabled', () => {
    const options = createTestPolarOptions({ client: mockClient })
    const ctx = createMockCtx()

    installUserDeletePrecondition(ctx, options)

    expect(ctx.options.user?.deleteUser?.beforeDelete).toBeUndefined()
  })

  it('no-ops when deleteUser is not configured', () => {
    const options = createTestPolarOptions({
      client: mockClient,
      experimental_organizationSync: { enabled: true },
    })
    const ctx = createMockCtx({ hasDeleteUser: false })

    installUserDeletePrecondition(ctx, options)

    expect(ctx.options.user?.deleteUser?.beforeDelete).toBeUndefined()
  })

  it('installs a beforeDelete that calls the sole-creator precondition', async () => {
    const options = createTestPolarOptions({
      client: mockClient,
      experimental_organizationSync: { enabled: true },
    })
    const ctx = createMockCtx()
    vi.mocked(assertUserDeletionSoleCreatorInvariant).mockResolvedValue()

    installUserDeletePrecondition(ctx, options)

    expect(typeof ctx.options.user?.deleteUser?.beforeDelete).toBe('function')
    const beforeDelete = ctx.options.user?.deleteUser?.beforeDelete
    if (!beforeDelete) throw new Error('beforeDelete was not installed')

    const mockUser = createMockUser()
    await beforeDelete(mockUser)

    expect(assertUserDeletionSoleCreatorInvariant).toHaveBeenCalledOnce()
    expect(
      vi.mocked(assertUserDeletionSoleCreatorInvariant).mock.calls[0],
    ).toEqual([ctx, mockClient, mockUser])
  })

  it('chains a host-supplied beforeDelete before the Polar precondition', async () => {
    const hostBeforeDelete = vi.fn(async () => {})
    const options = createTestPolarOptions({
      client: mockClient,
      experimental_organizationSync: { enabled: true },
    })
    const ctx = createMockCtx({ beforeDelete: hostBeforeDelete })
    vi.mocked(assertUserDeletionSoleCreatorInvariant).mockResolvedValue()

    installUserDeletePrecondition(ctx, options)

    const beforeDelete = ctx.options.user?.deleteUser?.beforeDelete
    if (!beforeDelete) throw new Error('beforeDelete was not installed')

    const mockUser = createMockUser()
    const mockRequest = new Request(
      'http://localhost:3000/api/auth/delete-user',
      {
        method: 'POST',
      },
    )
    await beforeDelete(mockUser, mockRequest)

    expect(hostBeforeDelete).toHaveBeenCalledOnce()
    expect(hostBeforeDelete).toHaveBeenCalledWith(mockUser, mockRequest)
    expect(assertUserDeletionSoleCreatorInvariant).toHaveBeenCalledOnce()
    expect(
      vi.mocked(assertUserDeletionSoleCreatorInvariant).mock
        .invocationCallOrder[0],
    ).toBeGreaterThan(hostBeforeDelete.mock.invocationCallOrder[0])
  })

  it('does not call the Polar precondition when the host beforeDelete throws', async () => {
    const hostError = new Error('host cleanup failed')
    const hostBeforeDelete = vi.fn(async () => {
      throw hostError
    })
    const options = createTestPolarOptions({
      client: mockClient,
      experimental_organizationSync: { enabled: true },
    })
    const ctx = createMockCtx({ beforeDelete: hostBeforeDelete })
    vi.mocked(assertUserDeletionSoleCreatorInvariant).mockResolvedValue()

    installUserDeletePrecondition(ctx, options)

    const beforeDelete = ctx.options.user?.deleteUser?.beforeDelete
    if (!beforeDelete) throw new Error('beforeDelete was not installed')

    const mockRequest = new Request(
      'http://localhost:3000/api/auth/delete-user',
      {
        method: 'POST',
      },
    )
    await expect(beforeDelete(createMockUser(), mockRequest)).rejects.toBe(
      hostError,
    )

    expect(hostBeforeDelete).toHaveBeenCalledOnce()
    expect(assertUserDeletionSoleCreatorInvariant).not.toHaveBeenCalled()
  })
})
