import { betterAuth } from 'better-auth'
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory'
import { APIError } from 'better-auth/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { polar } from '../../server'
import { createTestPolarOptions } from '../utils/helpers'
import { createMockCustomer, createMockPolarClient } from '../utils/mocks'

describe('customer creation during signup', () => {
  let database: MemoryDB
  let client: ReturnType<typeof createMockPolarClient>
  const beforeUserCreate = vi.fn()
  const getCustomerCreateParams = vi.fn()
  let auth: ReturnType<typeof betterAuth>

  beforeEach(() => {
    database = { user: [], account: [], session: [], verification: [] }
    client = createMockPolarClient()
    beforeUserCreate.mockReset()
    getCustomerCreateParams
      .mockReset()
      .mockResolvedValue({ metadata: { source: 'signup' } })
    vi.mocked(client.customers.list).mockResolvedValue({
      items: [],
      pagination: { total_count: 0, max_page: 1 },
    })
    auth = betterAuth({
      baseURL: 'http://localhost:3000',
      secret: 'better-auth-secret-that-is-long-enough-for-tests',
      database: memoryAdapter(database),
      emailAndPassword: { enabled: true },
      rateLimit: { enabled: false },
      logger: { disabled: true },
      databaseHooks: { user: { create: { before: beforeUserCreate } } },
      plugins: [
        polar(createTestPolarOptions({ client, getCustomerCreateParams })),
      ],
    })
  })

  it('includes the persisted user ID in the initial Polar creation request', async () => {
    vi.mocked(client.customers.create).mockImplementation(async (params) => {
      expect(database.user).toHaveLength(1)
      expect(params.external_id).toBe(database.user[0].id)
      return createMockCustomer({ external_id: params.external_id })
    })

    const result = await auth.api.signUpEmail({
      body: {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      },
    })

    expect(result.user.id).toBeTruthy()
    expect(getCustomerCreateParams).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: result.user.id }),
    })
    expect(client.customers.create).toHaveBeenCalledExactlyOnceWith({
      external_id: result.user.id,
      email: 'test@example.com',
      name: 'Test User',
      metadata: { source: 'signup' },
    })
    expect(client.customers.update).not.toHaveBeenCalled()
  })

  it.each(['return false', 'throw'])(
    'makes no Polar calls when the application rejects user creation: %s',
    async (rejection) => {
      beforeUserCreate.mockImplementation(async () => {
        if (rejection === 'throw') {
          throw new APIError('FORBIDDEN', { message: 'Signup is not allowed' })
        }
        return false
      })

      await expect(
        auth.api.signUpEmail({
          body: {
            name: 'Rejected User',
            email: 'rejected@example.com',
            password: 'password123',
          },
        }),
      ).rejects.toThrow()

      expect(beforeUserCreate).toHaveBeenCalledOnce()
      expect(database.user).toHaveLength(0)
      expect(getCustomerCreateParams).not.toHaveBeenCalled()
      expect(client.customers.list).not.toHaveBeenCalled()
      expect(client.customers.create).not.toHaveBeenCalled()
      expect(client.customers.update).not.toHaveBeenCalled()
    },
  )
})
