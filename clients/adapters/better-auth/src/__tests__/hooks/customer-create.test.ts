import { APIError } from 'better-auth/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onAfterUserCreate } from '../../hooks/customer'
import { createTestPolarOptions } from '../utils/helpers'
import {
  createMockBetterAuthContext,
  createMockCustomer,
  createMockPolarClient,
  createMockUser,
} from '../utils/mocks'

describe('onAfterUserCreate', () => {
  let client: ReturnType<typeof createMockPolarClient>
  let context: ReturnType<typeof createMockBetterAuthContext>

  beforeEach(() => {
    client = createMockPolarClient()
    context = createMockBetterAuthContext()
    vi.mocked(client.customers.list).mockResolvedValue({
      items: [],
      pagination: { total_count: 0, max_page: 1 },
    })
  })

  it('creates the customer with the user identity and custom metadata in one call', async () => {
    const user = createMockUser()
    const getCustomerCreateParams = vi.fn().mockResolvedValue({
      metadata: { source: 'signup' },
      external_id: 'another-user',
      email: 'another@example.com',
      name: 'Another User',
    })
    const hook = onAfterUserCreate(
      createTestPolarOptions({ client, getCustomerCreateParams }),
    )

    await hook(user, context)

    expect(getCustomerCreateParams).toHaveBeenCalledWith({ user })
    expect(client.customers.create).toHaveBeenCalledExactlyOnceWith({
      metadata: { source: 'signup' },
      email: user.email,
      name: user.name,
      external_id: user.id,
    })
    expect(client.customers.update).not.toHaveBeenCalled()
  })

  it.each([
    { externalId: null, linksCustomer: true },
    { externalId: 'user-123', linksCustomer: false },
  ])(
    'reuses a customer with external ID $externalId',
    async ({ externalId, linksCustomer }) => {
      const user = createMockUser({ id: 'user-123' })
      const customer = createMockCustomer({ external_id: externalId })
      vi.mocked(client.customers.list).mockResolvedValue({
        items: [customer],
        pagination: { total_count: 1, max_page: 1 },
      })
      const getCustomerCreateParams = vi.fn()

      await onAfterUserCreate(
        createTestPolarOptions({ client, getCustomerCreateParams }),
      )(user, context)

      expect(client.customers.list).toHaveBeenCalledWith({ email: user.email })
      expect(client.customers.create).not.toHaveBeenCalled()
      expect(getCustomerCreateParams).not.toHaveBeenCalled()
      if (linksCustomer) {
        expect(client.customers.update).toHaveBeenCalledExactlyOnceWith(
          customer.id,
          {
            external_id: user.id,
          },
        )
      } else {
        expect(client.customers.update).not.toHaveBeenCalled()
      }
    },
  )

  it('rejects a customer linked to another user without attempting reassignment', async () => {
    vi.mocked(client.customers.list).mockResolvedValue({
      items: [createMockCustomer({ external_id: 'another-user' })],
      pagination: { total_count: 1, max_page: 1 },
    })

    await expect(
      onAfterUserCreate(createTestPolarOptions({ client }))(
        createMockUser(),
        context,
      ),
    ).rejects.toMatchObject({
      status: 'CONFLICT',
      body: { message: 'Polar customer is already linked to a different user' },
    })
    expect(client.customers.create).not.toHaveBeenCalled()
    expect(client.customers.update).not.toHaveBeenCalled()
  })

  it.each(['disabled', 'anonymous', 'missing context'])(
    'skips Polar calls when %s',
    async (scenario) => {
      const user = {
        ...createMockUser(),
        isAnonymous: scenario === 'anonymous',
      }
      const getCustomerCreateParams = vi.fn()
      const options = createTestPolarOptions({
        client,
        createCustomerOnSignUp: scenario !== 'disabled',
        getCustomerCreateParams,
      })

      await onAfterUserCreate(options)(
        user,
        scenario === 'missing context' ? null : context,
      )

      expect(client.customers.list).not.toHaveBeenCalled()
      expect(client.customers.create).not.toHaveBeenCalled()
      expect(client.customers.update).not.toHaveBeenCalled()
      expect(getCustomerCreateParams).not.toHaveBeenCalled()
    },
  )

  it.each([new Error('Polar unavailable'), 'Polar unavailable'])(
    'reports customer creation failures: %s',
    async (error) => {
      vi.mocked(client.customers.create).mockRejectedValue(error)

      await expect(
        onAfterUserCreate(createTestPolarOptions({ client }))(
          createMockUser(),
          context,
        ),
      ).rejects.toMatchObject({
        status: 'INTERNAL_SERVER_ERROR',
        body: {
          message: 'Polar customer creation failed. Error: Polar unavailable',
        },
      })
    },
  )

  it('preserves a custom callback API error', async () => {
    const error = new APIError('BAD_REQUEST', { message: 'Invalid metadata' })
    const getCustomerCreateParams = vi.fn().mockRejectedValue(error)

    await expect(
      onAfterUserCreate(
        createTestPolarOptions({ client, getCustomerCreateParams }),
      )(createMockUser(), context),
    ).rejects.toBe(error)
    expect(client.customers.create).not.toHaveBeenCalled()
  })
})
