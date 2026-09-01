import type { AuthContext } from 'better-auth'
import type { Member } from 'better-auth/plugins/organization'
import { describe, expect, it, vi } from 'vitest'
import {
  type BillingPrincipalSession,
  resolveBillingPrincipal,
} from '../principal'

const createMembership = (overrides: Partial<Member> = {}): Member => ({
  id: 'membership-123',
  organizationId: 'organization-123',
  organizationEnabled: true,
  userId: 'user-123',
  role: 'member',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  ...overrides,
})

const createSession = (
  overrides: Partial<BillingPrincipalSession['user']> = {},
): BillingPrincipalSession => ({
  user: {
    id: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
    ...overrides,
  },
})

const createContext = (membership: Member | null = null) => {
  const findOne = vi.fn()
  const adapterFindOne: AuthContext['adapter']['findOne'] = async <T>(data) => {
    findOne(data)
    return membership as T | null
  }

  return {
    context: { adapter: { findOne: adapterFindOne } },
    findOne,
  }
}

describe('resolveBillingPrincipal', () => {
  describe('individual principals', () => {
    it('preserves unauthenticated personal behavior without querying membership', async () => {
      const { context, findOne } = createContext()

      await expect(
        resolveBillingPrincipal({ context, session: null }),
      ).resolves.toEqual({
        kind: 'individual',
        externalCustomerId: undefined,
      })
      expect(findOne).not.toHaveBeenCalled()
    })

    it('uses the authenticated user ID for a personal customer', async () => {
      const { context, findOne } = createContext()

      await expect(
        resolveBillingPrincipal({ context, session: createSession() }),
      ).resolves.toEqual({
        kind: 'individual',
        externalCustomerId: 'user-123',
      })
      expect(findOne).not.toHaveBeenCalled()
    })

    it("preserves an anonymous user's personal identity", async () => {
      const { context } = createContext()

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession({ isAnonymous: true }),
        }),
      ).resolves.toEqual({
        kind: 'individual',
        externalCustomerId: 'user-123',
      })
    })

    it('does not infer organization selection from the active organization', async () => {
      const { context, findOne } = createContext(
        createMembership({ organizationId: 'active-organization' }),
      )
      const session = {
        ...createSession(),
        session: { activeOrganizationId: 'active-organization' },
      }

      await expect(
        resolveBillingPrincipal({ context, session }),
      ).resolves.toMatchObject({
        kind: 'individual',
        externalCustomerId: 'user-123',
      })
      expect(findOne).not.toHaveBeenCalled()
    })
  })

  describe('team membership authorization', () => {
    it('rejects organization selection when Polar organization support is disabled', async () => {
      const { context, findOne } = createContext(createMembership())

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession(),
          organizationId: 'organization-123',
          organizationEnabled: false,
        }),
      ).rejects.toMatchObject({ status: 'BAD_REQUEST' })
      expect(findOne).not.toHaveBeenCalled()
    })

    it('resolves a team principal from a verified membership', async () => {
      const membership = createMembership({ role: 'member' })
      const { context, findOne } = createContext(membership)

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession(),
          organizationId: 'organization-123',
          organizationEnabled: true,
        }),
      ).resolves.toEqual({
        kind: 'team',
        externalCustomerId: 'organization-123',
        externalMemberId: 'user-123',
      })
      expect(findOne).toHaveBeenCalledOnce()
      expect(findOne).toHaveBeenCalledWith({
        model: 'member',
        where: [
          { field: 'userId', value: 'user-123' },
          { field: 'organizationId', value: 'organization-123' },
        ],
      })
    })

    it("uses Better Auth's logical member model for custom schema mapping", async () => {
      const { context, findOne } = createContext(createMembership())

      await resolveBillingPrincipal({
        context,
        session: createSession(),
        organizationId: 'organization-123',
        organizationEnabled: true,
      })

      // Better Auth's context adapter translates this logical name and fields
      // to any configured physical model/column names.
      expect(findOne.mock.calls[0]?.[0].model).toBe('member')
    })

    it('rejects an unauthenticated organization request before adapter access', async () => {
      const { context, findOne } = createContext()

      await expect(
        resolveBillingPrincipal({
          context,
          session: null,
          organizationId: 'organization-123',
          organizationEnabled: true,
        }),
      ).rejects.toMatchObject({
        status: 'UNAUTHORIZED',
        statusCode: 401,
      })
      expect(findOne).not.toHaveBeenCalled()
    })

    it('rejects an anonymous organization request before adapter access', async () => {
      const { context, findOne } = createContext()

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession({ isAnonymous: true }),
          organizationId: 'organization-123',
          organizationEnabled: true,
        }),
      ).rejects.toMatchObject({
        status: 'UNAUTHORIZED',
        statusCode: 401,
      })
      expect(findOne).not.toHaveBeenCalled()
    })

    it('rejects a spoofed organization ID when the exact membership is absent', async () => {
      const { context, findOne } = createContext(null)

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession(),
          organizationId: 'other-organization',
          organizationEnabled: true,
        }),
      ).rejects.toMatchObject({
        status: 'FORBIDDEN',
        statusCode: 403,
      })
      expect(findOne).toHaveBeenCalledWith({
        model: 'member',
        where: [
          { field: 'userId', value: 'user-123' },
          { field: 'organizationId', value: 'other-organization' },
        ],
      })
    })

    it('does not trust a matching active organization without membership', async () => {
      const { context } = createContext(null)
      const session = {
        ...createSession(),
        session: { activeOrganizationId: 'organization-123' },
      }

      await expect(
        resolveBillingPrincipal({
          context,
          session,
          organizationId: 'organization-123',
          organizationEnabled: true,
        }),
      ).rejects.toMatchObject({ status: 'FORBIDDEN' })
    })

    it('propagates adapter failures without converting them to denial', async () => {
      const databaseError = new Error('database unavailable')
      const findOne: AuthContext['adapter']['findOne'] = async () => {
        throw databaseError
      }

      await expect(
        resolveBillingPrincipal({
          context: { adapter: { findOne } },
          session: createSession(),
          organizationId: 'organization-123',
          organizationEnabled: true,
        }),
      ).rejects.toBe(databaseError)
    })
  })

  describe('billing authorization', () => {
    it.each(['owner', 'admin'])('allows the default %s role', async (role) => {
      const { context } = createContext(createMembership({ role }))

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession(),
          organizationId: 'organization-123',
          organizationEnabled: true,
          authorization: 'billing',
        }),
      ).resolves.toMatchObject({
        kind: 'team',
      })
    })

    it('denies an ordinary member billing authorization', async () => {
      const { context } = createContext(createMembership({ role: 'member' }))

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession(),
          organizationId: 'organization-123',
          organizationEnabled: true,
          authorization: 'billing',
        }),
      ).rejects.toMatchObject({
        status: 'FORBIDDEN',
        body: {
          message: 'Organization billing access requires a billing role',
        },
      })
    })

    it("authorizes Better Auth's custom creator role", async () => {
      const { context } = createContext(createMembership({ role: 'founder' }))

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession(),
          organizationId: 'organization-123',
          organizationEnabled: true,
          authorization: 'billing',
          roleMapping: { creatorRole: 'founder' },
        }),
      ).resolves.toMatchObject({
        kind: 'team',
      })
    })

    it('authorizes configured custom roles in a comma-separated role', async () => {
      const { context } = createContext(
        createMembership({ role: 'member, finance' }),
      )

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession(),
          organizationId: 'organization-123',
          organizationEnabled: true,
          authorization: 'billing',
          roleMapping: { billingManagerRoles: ['finance'] },
        }),
      ).resolves.toMatchObject({
        kind: 'team',
      })
    })

    it('authorizes a role mapped to Polar billing manager by a custom mapper', async () => {
      const { context } = createContext(
        createMembership({ role: 'member, finance' }),
      )
      const mapBetterAuthRoleToPolarRole = vi
        .fn()
        .mockResolvedValue('billing_manager' as const)

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession(),
          organizationId: 'organization-123',
          organizationEnabled: true,
          authorization: 'billing',
          roleMapping: { mapBetterAuthRoleToPolarRole },
        }),
      ).resolves.toMatchObject({ kind: 'team' })
      expect(mapBetterAuthRoleToPolarRole).toHaveBeenCalledWith({
        role: 'member, finance',
        roles: new Set(['member', 'finance']),
        organizationId: 'organization-123',
        user: {
          id: 'user-123',
          email: 'user@example.com',
          name: 'Test User',
        },
      })
    })

    it('denies a role mapped to an ordinary Polar member', async () => {
      const { context } = createContext(createMembership({ role: 'finance' }))

      await expect(
        resolveBillingPrincipal({
          context,
          session: createSession(),
          organizationId: 'organization-123',
          organizationEnabled: true,
          authorization: 'billing',
          roleMapping: {
            mapBetterAuthRoleToPolarRole: async () => 'member',
          },
        }),
      ).rejects.toMatchObject({ status: 'FORBIDDEN' })
    })
  })
})
