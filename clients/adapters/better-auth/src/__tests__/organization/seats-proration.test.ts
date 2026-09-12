import type { AuthContext } from 'better-auth'
import {
  getOrgAdapter,
  type Member,
  type Organization,
} from 'better-auth/plugins/organization'
import { describe, expect, it, vi } from 'vitest'
import { errors, type models } from '@polar-sh/sdk/2026-04'
import { synchronizeOrganizationSeats } from '../../organization/seats'
import type { PolarOrganizationOptions } from '../../organization/types'
import { createMockPolarClient } from '../utils/mocks'

vi.mock('better-auth/plugins/organization', () => ({
  getOrgAdapter: vi.fn(),
}))

const { CustomerSeatsAssignSeat400Error } = errors

const ACTIVE = new Set(['pending', 'claimed'])
const ORGANIZATION_ID = 'organization-123'
const PRODUCT_ID = 'product-pro'

type ProrationBehavior = 'prorate' | 'invoice' | 'next_period'
type ImmediateProration = Exclude<ProrationBehavior, 'next_period'>

interface RosterEntry {
  userId: string
  role: string
}

interface SeatMock {
  id: string
  status: 'pending' | 'claimed' | 'revoked'
  member: { external_id: string } | null
}

interface Harness {
  client: ReturnType<typeof createMockPolarClient>
  authContext: AuthContext
  subscriptions: Map<string, models.Subscription>
  subscriptionSeats: Map<string, SeatMock[]>
  pendingSeats: (subscriptionId: string) => number | null
  seed: (input: {
    seats: number
    seatedMemberIds: readonly string[]
  }) => models.Subscription
  applyPendingUpdate: (subscriptionId: string) => void
}

const seatProduct = (): models.Product =>
  ({
    id: PRODUCT_ID,
    is_recurring: true,
    prices: [
      {
        amount_type: 'seat_based',
        seat_tiers: { minimum_seats: 1 },
      },
    ],
  }) as unknown as models.Product

const createHarness = (
  proration: ProrationBehavior,
  roster: readonly RosterEntry[],
): Harness => {
  const client = createMockPolarClient()
  const subscriptions = new Map<string, models.Subscription>()
  const subscriptionSeats = new Map<string, SeatMock[]>()
  let nextSeatId = 1

  const users = roster.map((entry) => ({
    id: entry.userId,
    email: `${entry.userId}@example.com`,
    name: entry.userId,
    image: null as string | null,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  const org: Organization = {
    id: ORGANIZATION_ID,
    name: 'Acme',
    slug: 'acme',
    logo: null,
    createdAt: new Date(),
  } as Organization

  const members: Member[] = roster.map((entry) => ({
    id: `membership-${entry.userId}`,
    organizationId: ORGANIZATION_ID,
    userId: entry.userId,
    role: entry.role,
    createdAt: new Date(),
  })) as unknown as Member[]

  const authContext = {
    adapter: {
      findOne: vi.fn(async ({ model, where }: any) => {
        if (model !== 'organization') return null
        const id = where.find((clause: any) => clause.field === 'id')?.value
        return id === ORGANIZATION_ID ? org : null
      }),
      findMany: vi.fn(async ({ model, where }: any) => {
        if (model === 'user') {
          const ids = where[0].value as string[]
          return users.filter((user) => ids.includes(user.id))
        }
        return []
      }),
    },
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as AuthContext

  vi.mocked(getOrgAdapter).mockReturnValue({
    listMembers: vi.fn(async () => ({
      members: members.map((member) => ({
        ...member,
        user: {
          id: member.userId,
          email: `${member.userId}@example.com`,
          name: member.userId,
          image: null,
        },
      })),
      total: members.length,
    })),
  } as never)

  const activeCount = (subscriptionId: string) =>
    (subscriptionSeats.get(subscriptionId) ?? []).filter((seat) =>
      ACTIVE.has(seat.status),
    ).length

  vi.mocked(client.subscriptions.update).mockImplementation(
    async (id: string, body: any) => {
      const current = subscriptions.get(id)
      if (!current) throw new Error(`Subscription "${id}" was not seeded`)
      const requested = (body?.seats ?? current.seats ?? 0) as number
      const oldSeats = current.seats ?? 0
      const updated: any = { ...current }
      if (requested !== oldSeats) {
        if (proration === 'next_period') {
          // Server stages the new seat count into pending_update and leaves
          // the live `seats` unchanged (mirrors
          // server/polar/subscription/service.py:2371-2374 under next_period).
          updated.pending_update = {
            id: `${id}-pending`,
            created_at: new Date().toISOString(),
            modified_at: null,
            applies_at: new Date(Date.now() + 86_400_000).toISOString(),
            product_id: null,
            seats: requested,
            units: null,
          }
        } else {
          updated.seats = requested
          updated.pending_update = null
        }
      }
      subscriptions.set(id, updated)
      return updated as models.Subscription
    },
  )

  vi.mocked(client.customerSeats.listSeats).mockImplementation(
    async (query: any) => {
      const subscriptionId = query?.subscription_id
      if (!subscriptionId) throw new Error('subscription_id is required')
      const sub = subscriptions.get(subscriptionId)
      const seats = subscriptionSeats.get(subscriptionId) ?? []
      const available = Math.max(
        0,
        (sub?.seats ?? 0) - activeCount(subscriptionId),
      )
      return {
        seats: [...seats],
        available_seats: available,
        total_seats: seats.length,
      } as never
    },
  )

  vi.mocked(client.customerSeats.assignSeat).mockImplementation(
    async (input: any) => {
      const subscriptionId = input?.subscription_id as string
      const externalMemberId = input?.external_member_id as string
      const sub = subscriptions.get(subscriptionId)
      if (!sub)
        throw new Error(`Subscription "${subscriptionId}" was not seeded`)
      // Availability is computed from the LIVE subscription.seats, not the
      // staged pending_update (mirrors
      // server/polar/customer_seat/repository.py:173-181 and
      // service.py:281-290 which raise SeatNotAvailable when available <= 0).
      const available = (sub.seats ?? 0) - activeCount(subscriptionId)
      if (available <= 0) {
        throw new CustomerSeatsAssignSeat400Error(400, null)
      }
      const seat: SeatMock = {
        id: `seat-${nextSeatId++}`,
        status: 'claimed',
        member: { external_id: externalMemberId },
      }
      subscriptionSeats.set(subscriptionId, [
        ...(subscriptionSeats.get(subscriptionId) ?? []),
        seat,
      ])
      return seat as never
    },
  )

  vi.mocked(client.customerSeats.revokeSeat).mockImplementation(
    async (seatId: string) => {
      for (const [subscriptionId, seats] of subscriptionSeats) {
        subscriptionSeats.set(
          subscriptionId,
          seats.map((seat) =>
            seat.id === seatId ? { ...seat, status: 'revoked' } : seat,
          ),
        )
      }
    },
  )

  const seed = (input: {
    seats: number
    seatedMemberIds: readonly string[]
  }): models.Subscription => {
    const id = `subscription-${ORGANIZATION_ID}`
    const seededSeats: SeatMock[] = input.seatedMemberIds.map(
      (externalMemberId) => ({
        id: `seat-${nextSeatId++}`,
        status: 'claimed',
        member: { external_id: externalMemberId },
      }),
    )
    const product = seatProduct()
    const subscription = {
      id,
      product_id: PRODUCT_ID,
      product,
      prices: product.prices,
      status: 'active',
      seats: input.seats,
      pending_update: null,
      customer: { type: 'team', external_id: ORGANIZATION_ID },
    } as unknown as models.Subscription
    subscriptions.set(id, subscription)
    subscriptionSeats.set(id, seededSeats)
    return subscription
  }

  const applyPendingUpdate = (subscriptionId: string) => {
    const sub = subscriptions.get(subscriptionId) as any
    if (!sub) throw new Error(`Subscription "${subscriptionId}" was not seeded`)
    const pending = sub.pending_update
    if (pending && typeof pending.seats === 'number') {
      // Mirrors subscription.cycle applying the pending update at the next
      // billing period (server/polar/subscription/service.py:1204).
      sub.seats = pending.seats
      sub.pending_update = null
      subscriptions.set(subscriptionId, sub)
    }
  }

  const pendingSeats = (subscriptionId: string) =>
    (subscriptions.get(subscriptionId) as any)?.pending_update?.seats ?? null

  return {
    client,
    authContext,
    subscriptions,
    subscriptionSeats,
    pendingSeats,
    seed,
    applyPendingUpdate,
  }
}

const ORGANIZATION_OPTIONS: PolarOrganizationOptions = {
  enabled: true,
  syncSeats: true,
} as PolarOrganizationOptions

const runSync = (harness: Harness, subscription: models.Subscription) =>
  synchronizeOrganizationSeats({
    authContext: harness.authContext,
    client: harness.client,
    organizationId: ORGANIZATION_ID,
    organizationOptions: ORGANIZATION_OPTIONS,
    betterAuthOrganizationOptions: { creatorRole: 'owner' } as never,
    subscriptions: [subscription],
  })

describe('synchronizeOrganizationSubscriptionSeats proration', () => {
  const owner = { userId: 'owner-1', role: 'owner' }
  const added = { userId: 'added-1', role: 'member' }

  it.each(['prorate', 'invoice'] as const)(
    'assigns the new member immediately under `%s` proration (no regression)',
    async (proration: ImmediateProration) => {
      const harness = createHarness(proration, [owner, added])
      const subscription = harness.seed({
        seats: 1,
        seatedMemberIds: [owner.userId],
      })
      await runSync(harness, subscription)

      expect(harness.client.subscriptions.update).toHaveBeenCalledWith(
        subscription.id,
        { seats: 2 },
      )
      expect(harness.client.customerSeats.assignSeat).toHaveBeenCalledTimes(1)
      expect(harness.client.customerSeats.assignSeat).toHaveBeenCalledWith({
        subscription_id: subscription.id,
        external_member_id: added.userId,
        immediate_claim: true,
      })
      expect(harness.client.customerSeats.revokeSeat).not.toHaveBeenCalled()
      expect(harness.subscriptions.get(subscription.id)?.seats).toBe(2)
      expect(harness.pendingSeats(subscription.id)).toBeNull()
    },
  )

  it('defers the new member when `next_period` stages the seat increase', async () => {
    const harness = createHarness('next_period', [owner, added])
    const subscription = harness.seed({
      seats: 1,
      seatedMemberIds: [owner.userId],
    })

    // The buggy increase-then-immediately-assign ordering would reach
    // assignSeat for the new member against the unchanged live capacity and
    // reject with CustomerSeatsAssignSeat400Error (SeatNotAvailable). The fix
    // defers the assignment, so the sync must resolve without throwing.
    await expect(runSync(harness, subscription)).resolves.toBeUndefined()

    expect(harness.client.subscriptions.update).toHaveBeenCalledWith(
      subscription.id,
      { seats: 2 },
    )
    expect(harness.client.customerSeats.assignSeat).not.toHaveBeenCalled()
    expect(harness.client.customerSeats.revokeSeat).not.toHaveBeenCalled()
    expect(harness.subscriptions.get(subscription.id)?.seats).toBe(1)
    expect(harness.pendingSeats(subscription.id)).toBe(2)
    // The owner's pre-existing seat is left in place.
    expect(harness.subscriptionSeats.get(subscription.id)).toHaveLength(1)
  })

  it('seats members only up to the live capacity when `next_period` stages a larger increase', async () => {
    const roster = [
      owner,
      { userId: 'added-a', role: 'member' },
      { userId: 'added-b', role: 'member' },
      { userId: 'added-c', role: 'member' },
    ]
    const harness = createHarness('next_period', roster)
    const subscription = harness.seed({
      seats: 2,
      seatedMemberIds: [owner.userId],
    })
    const newMembers = ['added-a', 'added-b', 'added-c']

    await expect(runSync(harness, subscription)).resolves.toBeUndefined()

    expect(harness.client.subscriptions.update).toHaveBeenCalledWith(
      subscription.id,
      { seats: 4 },
    )
    // Live capacity is 2 with 1 already held by the owner, so exactly one new
    // member fits; the rest are deferred rather than raising.
    expect(harness.client.customerSeats.assignSeat).toHaveBeenCalledTimes(1)
    const assignedMember = vi
      .mocked(harness.client.customerSeats.assignSeat)
      .mock.calls.at(0)?.[0] as { external_member_id: string } | undefined
    expect(newMembers).toContain(assignedMember?.external_member_id)
    expect(assignedMember?.external_member_id).not.toBe(owner.userId)
    expect(harness.subscriptions.get(subscription.id)?.seats).toBe(2)
    expect(harness.pendingSeats(subscription.id)).toBe(4)
    expect(harness.client.customerSeats.revokeSeat).not.toHaveBeenCalled()
  })

  it('seats the deferred member on the next sync after the staged update applies', async () => {
    const harness = createHarness('next_period', [owner, added])
    const subscription = harness.seed({
      seats: 1,
      seatedMemberIds: [owner.userId],
    })

    await runSync(harness, subscription)
    expect(harness.client.customerSeats.assignSeat).not.toHaveBeenCalled()

    // The next billing cycle applies the pending update, making the staged
    // seat count live. A subsequent roster-change sync then seats the member.
    harness.applyPendingUpdate(subscription.id)
    vi.mocked(harness.client.customerSeats.assignSeat).mockClear()

    const liveSubscription = harness.subscriptions.get(subscription.id)!
    await runSync(harness, liveSubscription)

    expect(harness.client.customerSeats.assignSeat).toHaveBeenCalledTimes(1)
    expect(harness.client.customerSeats.assignSeat).toHaveBeenCalledWith({
      subscription_id: subscription.id,
      external_member_id: added.userId,
      immediate_claim: true,
    })
    expect(harness.subscriptions.get(subscription.id)?.seats).toBe(2)
    expect(harness.pendingSeats(subscription.id)).toBeNull()
  })

  it('revokes departed members and decreases seats under `next_period`', async () => {
    const roster = [owner]
    const harness = createHarness('next_period', roster)
    const subscription = harness.seed({
      seats: 2,
      seatedMemberIds: [owner.userId, added.userId],
    })
    const removedSeat = harness.subscriptionSeats
      .get(subscription.id)!
      .find((seat) => seat.member?.external_id === added.userId)!

    await runSync(harness, subscription)

    expect(harness.client.customerSeats.revokeSeat).toHaveBeenCalledWith(
      removedSeat.id,
    )
    expect(harness.client.subscriptions.update).toHaveBeenCalledWith(
      subscription.id,
      { seats: 1 },
    )
    expect(harness.client.customerSeats.assignSeat).not.toHaveBeenCalled()
    expect(
      vi.mocked(harness.client.customerSeats.revokeSeat).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(harness.client.subscriptions.update).mock
        .invocationCallOrder[0] ?? 0,
    )
  })

  it('makes no writes when the roster already fits the live capacity', async () => {
    const harness = createHarness('prorate', [owner])
    const subscription = harness.seed({
      seats: 1,
      seatedMemberIds: [owner.userId],
    })

    await runSync(harness, subscription)

    expect(harness.client.subscriptions.update).not.toHaveBeenCalled()
    expect(harness.client.customerSeats.assignSeat).not.toHaveBeenCalled()
    expect(harness.client.customerSeats.revokeSeat).not.toHaveBeenCalled()
    expect(harness.subscriptions.get(subscription.id)?.seats).toBe(1)
    expect(harness.pendingSeats(subscription.id)).toBeNull()
  })
})
