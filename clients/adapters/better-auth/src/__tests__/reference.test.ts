import type { models } from '@polar-sh/sdk/2026-10'
import type { Member } from 'better-auth/plugins/organization'
import { describe, expect, it, vi } from 'vitest'
import {
  type ResolveReferenceAccessInput,
  resolveReferenceAccess,
  toEntitlementSubscription,
} from '../reference'

const createSession = (
  user: Record<string, unknown> = {},
): ResolveReferenceAccessInput['session'] =>
  ({
    user: {
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
      ...user,
    },
    session: { id: 'session-123', userId: 'user-123' },
  }) as unknown as ResolveReferenceAccessInput['session']

const createContext = ({
  organizationPlugin = true,
  membership = null,
  organization = null,
  user = null,
  failLookups = false,
}: {
  organizationPlugin?: boolean
  membership?: Pick<Member, 'role'> | null
  organization?: { id: string } | null
  user?: { id: string } | null
  failLookups?: boolean
} = {}) => {
  const findOne = vi.fn(async ({ model }: { model: string }) => {
    if (failLookups) throw new Error('invalid input syntax for type uuid')
    return model === 'member' ? membership : organization
  })
  const findUserById = vi.fn(async () => {
    if (failLookups) throw new Error('invalid input syntax for type uuid')
    return user
  })

  return {
    context: {
      adapter: { findOne },
      internalAdapter: { findUserById },
      getPlugin: vi.fn(() =>
        organizationPlugin ? { options: {} } : undefined,
      ),
    } as unknown as ResolveReferenceAccessInput['context'],
    findOne,
    findUserById,
  }
}

describe('resolveReferenceAccess', () => {
  it("grants the entitlement view for the user's own ID without lookups", async () => {
    const { context, findOne, findUserById } = createContext()

    await expect(
      resolveReferenceAccess({
        context,
        session: createSession(),
        referenceId: 'user-123',
      }),
    ).resolves.toEqual({
      access: 'entitlements',
      referenceType: 'self',
      unauthorizedFallback: false,
    })
    expect(findOne).not.toHaveBeenCalled()
    expect(findUserById).not.toHaveBeenCalled()
  })

  it.each([
    ['owner', 'billing'],
    ['admin', 'billing'],
    ['member,admin', 'billing'],
    ['member', 'entitlements'],
  ] as const)(
    'grants an organization %s the %s view',
    async (role, expectedAccess) => {
      const { context, findOne } = createContext({ membership: { role } })

      await expect(
        resolveReferenceAccess({
          context,
          session: createSession(),
          referenceId: 'organization-123',
        }),
      ).resolves.toEqual({
        access: expectedAccess,
        referenceType: 'organization',
        unauthorizedFallback: false,
      })
      expect(findOne).toHaveBeenCalledWith({
        model: 'member',
        where: [
          { field: 'userId', value: 'user-123' },
          { field: 'organizationId', value: 'organization-123' },
        ],
      })
    },
  )

  it('applies the configured Better Auth to Polar role mapping', async () => {
    const { context } = createContext({ membership: { role: 'finance' } })

    await expect(
      resolveReferenceAccess({
        context,
        session: createSession(),
        referenceId: 'organization-123',
        mapBetterAuthRoleToPolarRole: ({ roles }) =>
          roles.has('finance') ? 'billing_manager' : 'member',
      }),
    ).resolves.toMatchObject({ access: 'billing' })
  })

  it("limits a non-member to their own purchases for another user's organization", async () => {
    const { context } = createContext({
      organization: { id: 'organization-123' },
    })

    await expect(
      resolveReferenceAccess({
        context,
        session: createSession(),
        referenceId: 'organization-123',
      }),
    ).resolves.toEqual({
      access: 'own',
      referenceType: 'organization',
      unauthorizedFallback: false,
    })
  })

  it("limits the caller to their own purchases for another user's ID", async () => {
    const { context } = createContext({
      organizationPlugin: false,
      user: { id: 'user-456' },
    })

    await expect(
      resolveReferenceAccess({
        context,
        session: createSession(),
        referenceId: 'user-456',
      }),
    ).resolves.toEqual({
      access: 'own',
      referenceType: 'user',
      unauthorizedFallback: false,
    })
  })

  it.each([
    ['with the organization plugin', true],
    ['without the organization plugin', false],
  ])(
    'keeps the entitlement view for an unknown reference %s',
    async (_, organizationPlugin) => {
      const { context, findOne } = createContext({ organizationPlugin })

      await expect(
        resolveReferenceAccess({
          context,
          session: createSession(),
          referenceId: 'workspace-123',
        }),
      ).resolves.toEqual({
        access: 'entitlements',
        referenceType: 'unknown',
        unauthorizedFallback: true,
      })
      expect(findOne).toHaveBeenCalledTimes(organizationPlugin ? 2 : 0)
    },
  )

  it('treats a reference the database cannot look up as unknown', async () => {
    const { context } = createContext({ failLookups: true })

    await expect(
      resolveReferenceAccess({
        context,
        session: createSession(),
        referenceId: 'workspace-123',
      }),
    ).resolves.toEqual({
      access: 'entitlements',
      referenceType: 'unknown',
      unauthorizedFallback: true,
    })
  })

  it('limits anonymous users to their own purchases for an unknown reference', async () => {
    const { context } = createContext()

    await expect(
      resolveReferenceAccess({
        context,
        session: createSession({ isAnonymous: true }),
        referenceId: 'workspace-123',
      }),
    ).resolves.toEqual({
      access: 'own',
      referenceType: 'unknown',
      unauthorizedFallback: false,
    })
  })

  describe('authorizeReference', () => {
    it('receives the classification and removes the unknown-reference fallback', async () => {
      const { context } = createContext()
      const session = createSession()
      const request = new Request('http://localhost:3000')
      const authorizeReference = vi.fn(
        ({ defaultAccess }: { defaultAccess: string }) => defaultAccess,
      )

      await expect(
        resolveReferenceAccess({
          context,
          session,
          referenceId: 'workspace-123',
          authorizeReference: authorizeReference as never,
          request,
        }),
      ).resolves.toEqual({
        access: 'own',
        referenceType: 'unknown',
        unauthorizedFallback: false,
      })
      expect(authorizeReference).toHaveBeenCalledWith(
        {
          user: session.user,
          session: session.session,
          referenceId: 'workspace-123',
          action: 'list-subscriptions',
          referenceType: 'unknown',
          defaultAccess: 'own',
        },
        request,
      )
    })

    it.each([
      [true, 'entitlements'],
      [false, 'none'],
      ['billing', 'billing'],
      ['entitlements', 'entitlements'],
      ['own', 'own'],
      ['none', 'none'],
    ] as const)('maps %s to %s access', async (result, expectedAccess) => {
      const { context } = createContext()

      await expect(
        resolveReferenceAccess({
          context,
          session: createSession(),
          referenceId: 'workspace-123',
          authorizeReference: async () => result,
        }),
      ).resolves.toMatchObject({ access: expectedAccess })
    })

    it('can override the organization membership decision', async () => {
      const { context } = createContext({ membership: { role: 'owner' } })

      await expect(
        resolveReferenceAccess({
          context,
          session: createSession(),
          referenceId: 'organization-123',
          authorizeReference: ({ defaultAccess, referenceType }) => {
            expect(defaultAccess).toBe('billing')
            expect(referenceType).toBe('organization')
            return false
          },
        }),
      ).resolves.toMatchObject({ access: 'none' })
    })
  })
})

describe('toEntitlementSubscription', () => {
  const subscription = {
    id: 'subscription-123',
    status: 'active',
    amount: 2000,
    currency: 'usd',
    current_period_end: '2026-12-23T00:00:00Z',
    customer_id: 'customer-123',
    product_id: 'product-123',
    discount_id: 'discount-123',
    seats: 5,
    customer_cancellation_reason: 'too_expensive',
    customer_cancellation_comment: 'Call me on +1 555 0100',
    metadata: { referenceId: 'organization-123', internalNote: 'VIP' },
    custom_field_data: { vat: 'FR123' },
    customer: {
      id: 'customer-123',
      email: 'buyer@example.com',
      billing_address: { country: 'FR' },
    },
    discount: { id: 'discount-123', code: 'SECRET50' },
    prices: [{ id: 'price-123', amount_type: 'fixed', price_amount: 2000 }],
    pending_update: null,
    product: {
      id: 'product-123',
      name: 'Pro',
      organization_id: 'polar-organization',
      metadata: { internalTier: 'gold' },
      attached_custom_fields: [{ custom_field_id: 'field-123' }],
      prices: [{ id: 'price-123' }],
      medias: [],
      benefits: [
        {
          id: 'benefit-123',
          type: 'custom',
          description: 'Priority support',
          metadata: { internal: true },
          properties: { note: 'Private invite link' },
        },
      ],
    },
    meters: [
      {
        id: 'subscription-meter-123',
        consumed_units: 10,
        credited_units: 100,
        amount: 0,
        meter_id: 'meter-123',
        meter: {
          id: 'meter-123',
          name: 'API calls',
          metadata: { internal: true },
          filter: { conjunction: 'and', clauses: [] },
        },
      },
    ],
    a_field_added_to_the_api_later: 'private',
  } as unknown as models.Subscription

  it('keeps the fields an entitlement check needs', () => {
    expect(toEntitlementSubscription(subscription, 'organization-123')).toEqual(
      {
        id: 'subscription-123',
        status: 'active',
        amount: 2000,
        currency: 'usd',
        current_period_end: '2026-12-23T00:00:00Z',
        customer_id: 'customer-123',
        product_id: 'product-123',
        discount_id: 'discount-123',
        seats: 5,
        metadata: { referenceId: 'organization-123' },
        prices: [{ id: 'price-123', amount_type: 'fixed', price_amount: 2000 }],
        pending_update: null,
        product: {
          id: 'product-123',
          name: 'Pro',
          organization_id: 'polar-organization',
          prices: [{ id: 'price-123' }],
          medias: [],
          benefits: [
            {
              id: 'benefit-123',
              type: 'custom',
              description: 'Priority support',
            },
          ],
        },
        meters: [
          {
            id: 'subscription-meter-123',
            consumed_units: 10,
            credited_units: 100,
            amount: 0,
            meter_id: 'meter-123',
            meter: { id: 'meter-123', name: 'API calls' },
          },
        ],
      },
    )
  })
})
