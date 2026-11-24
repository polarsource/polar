import type { models } from '@polar-sh/sdk/2026-10'
import type { Member } from 'better-auth/plugins/organization'
import { describe, expect, it } from 'vitest'
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
} = {}) =>
  ({
    adapter: {
      findOne: async ({ model }: { model: string }) => {
        if (failLookups) throw new Error('invalid input syntax for type uuid')
        return model === 'member' ? membership : organization
      },
    },
    internalAdapter: {
      findUserById: async () => {
        if (failLookups) throw new Error('invalid input syntax for type uuid')
        return user
      },
    },
    getPlugin: () => (organizationPlugin ? { options: {} } : undefined),
  }) as unknown as ResolveReferenceAccessInput['context']

describe('resolveReferenceAccess', () => {
  it("grants the redacted view for the user's own ID", async () => {
    await expect(
      resolveReferenceAccess({
        context: createContext(),
        session: createSession(),
        referenceId: 'user-123',
      }),
    ).resolves.toEqual({
      access: 'redacted',
      referenceType: 'self',
      unauthorizedFallback: false,
    })
  })

  it.each([
    ['owner', 'full'],
    ['member', 'redacted'],
  ] as const)(
    'grants an organization %s the %s view',
    async (role, expectedAccess) => {
      await expect(
        resolveReferenceAccess({
          context: createContext({ membership: { role } }),
          session: createSession(),
          referenceId: 'organization-123',
        }),
      ).resolves.toEqual({
        access: expectedAccess,
        referenceType: 'organization',
        unauthorizedFallback: false,
      })
    },
  )

  it("limits a non-member to their own purchases for another user's organization", async () => {
    await expect(
      resolveReferenceAccess({
        context: createContext({ organization: { id: 'organization-123' } }),
        session: createSession(),
        referenceId: 'organization-123',
      }),
    ).resolves.toEqual({
      access: 'purchased',
      referenceType: 'organization',
      unauthorizedFallback: false,
    })
  })

  it("limits the caller to their own purchases for another user's ID", async () => {
    await expect(
      resolveReferenceAccess({
        context: createContext({
          organizationPlugin: false,
          user: { id: 'user-456' },
        }),
        session: createSession(),
        referenceId: 'user-456',
      }),
    ).resolves.toEqual({
      access: 'purchased',
      referenceType: 'user',
      unauthorizedFallback: false,
    })
  })

  it('keeps the redacted view for an unknown reference', async () => {
    await expect(
      resolveReferenceAccess({
        context: createContext(),
        session: createSession(),
        referenceId: 'workspace-123',
      }),
    ).resolves.toEqual({
      access: 'redacted',
      referenceType: 'unknown',
      unauthorizedFallback: true,
    })
  })

  it('treats a reference the database cannot look up as unknown', async () => {
    await expect(
      resolveReferenceAccess({
        context: createContext({ failLookups: true }),
        session: createSession(),
        referenceId: 'workspace-123',
      }),
    ).resolves.toMatchObject({ referenceType: 'unknown' })
  })

  it('limits anonymous users to their own purchases for an unknown reference', async () => {
    await expect(
      resolveReferenceAccess({
        context: createContext(),
        session: createSession({ isAnonymous: true }),
        referenceId: 'workspace-123',
      }),
    ).resolves.toEqual({
      access: 'purchased',
      referenceType: 'unknown',
      unauthorizedFallback: false,
    })
  })

  it('treats the authorizeReference result as final', async () => {
    await expect(
      resolveReferenceAccess({
        context: createContext({ membership: { role: 'owner' } }),
        session: createSession(),
        referenceId: 'organization-123',
        authorizeReference: () => false,
      }),
    ).resolves.toMatchObject({ access: 'none' })

    await expect(
      resolveReferenceAccess({
        context: createContext(),
        session: createSession(),
        referenceId: 'workspace-123',
        authorizeReference: ({ defaultAccess }) => defaultAccess,
      }),
    ).resolves.toEqual({
      access: 'purchased',
      referenceType: 'unknown',
      unauthorizedFallback: false,
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
