import type { AuthContext } from 'better-auth'
import { APIError } from 'better-auth/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { models } from '@polar-sh/sdk/2026-04'
import { synchronizeOrganizationSeats } from '../../organization/seats'
import type { PolarOrganizationOptions } from '../../organization/types'
import { createMockPolarClient } from '../utils/mocks'

vi.mock('better-auth/plugins/organization', () => ({
  getOrgAdapter: vi.fn(),
}))

import { getOrgAdapter } from 'better-auth/plugins/organization'

type TestMember = {
  id: string
  organizationId: string
  userId: string
  role: string
  createdAt: Date
}
type TestSeat = {
  id: string
  status: string
  member?: { external_id?: string }
}

const ORGANIZATION_ID = 'organization-1'

const buildRoster = (userIds: readonly string[]) => {
  const members: TestMember[] = userIds.map((userId, index) => ({
    id: `member-${index}`,
    organizationId: ORGANIZATION_ID,
    userId,
    role: 'member',
    createdAt: new Date(),
  }))
  return members
}

const createCappedProduct = (
  maximumSeats: number | null,
  id = 'product-pro',
): models.Product =>
  ({
    id,
    name: 'Seat product',
    metadata: {},
    is_recurring: true,
    prices: [
      {
        amount_type: 'seat_based',
        seat_tiers:
          maximumSeats == null
            ? { minimum_seats: 1 }
            : { minimum_seats: 1, maximum_seats: maximumSeats },
      },
    ],
  }) as models.Product

const buildSubscription = (
  product: models.Product,
  seats: number,
  organizationId = ORGANIZATION_ID,
): models.Subscription =>
  ({
    id: `subscription-${organizationId}`,
    product_id: product.id,
    product,
    prices: product.prices,
    status: 'active',
    seats,
    customer: { type: 'team', external_id: organizationId },
  }) as models.Subscription

const createContext = (members: TestMember[]): AuthContext => {
  const usersById = new Map(
    members.map((member) => [
      member.userId,
      {
        id: member.userId,
        email: `${member.userId}@example.com`,
        name: member.userId,
      },
    ]),
  )
  const adapter = {
    findOne: vi.fn(async ({ model }: { model: string }) => {
      if (model === 'organization') {
        return { id: ORGANIZATION_ID, name: 'Acme', slug: 'acme' }
      }
      return null
    }),
    findMany: vi.fn(
      async ({
        model,
        where,
      }: {
        model: string
        where: Array<{ value: string[] }>
      }) => {
        if (model === 'user') {
          const ids = where[0]?.value ?? []
          return ids
            .map((id) => usersById.get(id))
            .filter((user) => user != null)
        }
        return []
      },
    ),
  }
  return { adapter } as unknown as AuthContext
}

describe('synchronizeOrganizationSeats maximum_seats enforcement', () => {
  let client: ReturnType<typeof createMockPolarClient>
  const organizationOptions = {
    enabled: true,
    syncSeats: true,
  } as PolarOrganizationOptions
  const betterAuthOrganizationOptions = {} as Parameters<
    typeof synchronizeOrganizationSeats
  >[0]['betterAuthOrganizationOptions']

  beforeEach(() => {
    client = createMockPolarClient()
    vi.clearAllMocks()
  })

  const runSync = (
    product: models.Product,
    subscription: models.Subscription,
    memberIds: readonly string[],
  ) => {
    const members = buildRoster(memberIds)
    vi.mocked(getOrgAdapter).mockReturnValue({
      listMembers: vi.fn(async () => ({
        members,
        total: members.length,
      })) as never,
    } as never)
    vi.mocked(client.customerSeats.listSeats).mockResolvedValue({
      seats: [] as TestSeat[],
      available_seats: 0,
      total_seats: 0,
    } as never)
    return synchronizeOrganizationSeats({
      authContext: createContext(members),
      client,
      organizationId: ORGANIZATION_ID,
      organizationOptions,
      betterAuthOrganizationOptions,
      subscriptions: [subscription],
    })
  }

  it('throws a structured BAD_REQUEST and never updates seats when the roster exceeds a finite maximum_seats', async () => {
    const maximumSeats = 5
    const product = createCappedProduct(maximumSeats)
    const subscription = buildSubscription(product, 1)
    const memberIds = Array.from(
      { length: maximumSeats + 1 },
      (_, i) => `user-${i + 1}`,
    )

    const result = runSync(product, subscription, memberIds)

    await expect(result).rejects.toMatchObject({
      status: 'BAD_REQUEST',
      statusCode: 400,
    })
    const thrown = await result.catch((error) => error)
    expect(thrown).toBeInstanceOf(APIError)
    expect((thrown as Error).message).toMatch(/maximum number of seats/i)
    expect(client.subscriptions.update).not.toHaveBeenCalled()
    expect(client.customerSeats.assignSeat).not.toHaveBeenCalled()
  })

  it('syncs normally when the roster equals a finite maximum_seats', async () => {
    const maximumSeats = 5
    const product = createCappedProduct(maximumSeats)
    const subscription = buildSubscription(product, 1)
    const memberIds = Array.from(
      { length: maximumSeats },
      (_, i) => `user-${i + 1}`,
    )

    await runSync(product, subscription, memberIds)

    expect(client.subscriptions.update).toHaveBeenCalledWith(subscription.id, {
      seats: maximumSeats,
    })
    expect(client.customerSeats.assignSeat).toHaveBeenCalledTimes(maximumSeats)
  })

  it('syncs normally when the roster is below a finite maximum_seats', async () => {
    const maximumSeats = 10
    const product = createCappedProduct(maximumSeats)
    const subscription = buildSubscription(product, 1)
    const memberIds = ['user-1', 'user-2', 'user-3']

    await runSync(product, subscription, memberIds)

    expect(client.subscriptions.update).toHaveBeenCalledWith(subscription.id, {
      seats: memberIds.length,
    })
    expect(client.customerSeats.assignSeat).toHaveBeenCalledTimes(
      memberIds.length,
    )
  })

  it('treats a product with no maximum_seats as unlimited even past an arbitrary bound', async () => {
    const product = createCappedProduct(null)
    const subscription = buildSubscription(product, 1)
    const memberIds = Array.from({ length: 8 }, (_, i) => `user-${i + 1}`)

    await runSync(product, subscription, memberIds)

    expect(client.subscriptions.update).toHaveBeenCalledWith(subscription.id, {
      seats: memberIds.length,
    })
    expect(client.customerSeats.assignSeat).toHaveBeenCalledTimes(
      memberIds.length,
    )
  })
})
