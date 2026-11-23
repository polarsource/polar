import type { models } from '@polar-sh/sdk/2026-10'
import { betterAuth } from 'better-auth'
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory'
import { organization } from 'better-auth/plugins'
import { describe, expect, it, vi } from 'vitest'
import { portal } from '../plugins/portal'
import type { AuthorizeReference } from '../reference'
import { polar } from '../server'
import { createMockPolarClient } from './utils/mocks'

const baseURL = 'http://localhost:3000'

const createHarness = ({
  organizationPlugin = true,
  authorizeReference,
}: {
  organizationPlugin?: boolean
  authorizeReference?: AuthorizeReference
} = {}) => {
  const database: MemoryDB = {
    user: [],
    session: [],
    account: [],
    verification: [],
    organization: [],
    member: [],
    invitation: [],
  }
  const client = createMockPolarClient()
  const warn = vi.fn()
  const auth: any = betterAuth({
    baseURL,
    secret: 'better-auth-secret-that-is-long-enough-for-tests',
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    logger: {
      log: (level, message) => {
        if (level === 'warn') warn(message)
      },
    },
    plugins: [
      ...(organizationPlugin ? [organization()] : []),
      polar({
        client,
        createCustomerOnSignUp: false,
        authorizeReference,
        use: [portal()],
      }),
    ],
  })

  const signUp = async (name: string) => {
    const response = await auth.handler(
      new Request(`${baseURL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: `${name}@example.com`,
          password: 'password123',
          name,
        }),
      }),
    )
    if (!response.ok) {
      throw new Error(`Sign-up failed: ${await response.text()}`)
    }
    const cookie = response.headers
      .get('set-cookie')
      ?.match(/better-auth\.session_token=[^;,]+/)?.[0]
    if (!cookie) {
      throw new Error('Sign-up returned no Better Auth session cookie')
    }
    const { user } = (await response.json()) as { user: { id: string } }
    return { cookie, user }
  }

  const seedSubscriptions = (referenceId: string, purchaserId: string) => {
    const subscription = {
      id: 'subscription-123',
      status: 'active',
      product_id: 'product-pro',
      metadata: { referenceId, internalNote: 'VIP' },
      customer: {
        id: 'customer-123',
        external_id: purchaserId,
        email: 'buyer@example.com',
        billing_address: { country: 'FR' },
      },
      discount: { id: 'discount-123', code: 'SECRET50' },
      custom_field_data: { vat: 'FR123' },
      product: {
        id: 'product-pro',
        name: 'Pro',
        metadata: { internalTier: 'gold' },
        benefits: [{ id: 'benefit-123', properties: { note: 'Private' } }],
      },
      prices: [],
      meters: [],
    } as unknown as models.Subscription
    vi.mocked(client.subscriptions.list).mockImplementation(
      async (query: any) => {
        const items =
          query.metadata.referenceId === referenceId &&
          (query.external_customer_id === undefined ||
            query.external_customer_id === purchaserId)
            ? [subscription]
            : []
        return {
          items,
          pagination: { total_count: items.length, max_page: 1 },
        }
      },
    )
    return subscription
  }

  const listSubscriptions = async (cookie: string, referenceId: string) => {
    const response = await auth.handler(
      new Request(
        `${baseURL}/api/auth/customer/subscriptions/list?reference_id=${referenceId}&active=true`,
        { headers: { cookie } },
      ),
    )
    return {
      status: response.status as number,
      body: (await response.json()) as {
        items: Record<string, unknown>[]
      },
    }
  }

  const createOrganization = async (cookie: string) =>
    (await auth.api.createOrganization({
      headers: new Headers({ cookie }),
      body: { name: 'Acme', slug: 'acme' },
    })) as { id: string }

  const addMember = (
    cookie: string,
    organizationId: string,
    userId: string,
    role: string,
  ) =>
    auth.api.addMember({
      headers: new Headers({ cookie }),
      body: { organizationId, userId, role },
    })

  return {
    client,
    warn,
    signUp,
    seedSubscriptions,
    listSubscriptions,
    createOrganization,
    addMember,
  }
}

const entitlementSubscription = (referenceId: string) => ({
  id: 'subscription-123',
  status: 'active',
  product_id: 'product-pro',
  metadata: { referenceId },
  product: {
    id: 'product-pro',
    name: 'Pro',
    benefits: [{ id: 'benefit-123' }],
  },
  prices: [],
  meters: [],
})

describe('reference_id subscription access', () => {
  it('keeps the documented entitlement check working for organization members', async () => {
    const harness = createHarness()
    const owner = await harness.signUp('owner')
    const admin = await harness.signUp('admin')
    const member = await harness.signUp('member')
    const outsider = await harness.signUp('outsider')
    const { id: organizationId } = await harness.createOrganization(
      owner.cookie,
    )
    await harness.addMember(
      owner.cookie,
      organizationId,
      admin.user.id,
      'admin',
    )
    await harness.addMember(
      owner.cookie,
      organizationId,
      member.user.id,
      'member',
    )
    const subscription = harness.seedSubscriptions(
      organizationId,
      owner.user.id,
    )

    const ownerResult = await harness.listSubscriptions(
      owner.cookie,
      organizationId,
    )
    expect(ownerResult.body.items).toEqual([subscription])

    const adminResult = await harness.listSubscriptions(
      admin.cookie,
      organizationId,
    )
    expect(adminResult.body.items).toEqual([subscription])

    const memberResult = await harness.listSubscriptions(
      member.cookie,
      organizationId,
    )
    expect(memberResult.status).toBe(200)
    expect(memberResult.body.items).toEqual([
      entitlementSubscription(organizationId),
    ])
    expect(
      memberResult.body.items.some(
        (item) => item['product_id'] === 'product-pro',
      ),
    ).toBe(true)

    const outsiderResult = await harness.listSubscriptions(
      outsider.cookie,
      organizationId,
    )
    expect(outsiderResult.status).toBe(200)
    expect(outsiderResult.body.items).toEqual([])
    expect(harness.client.subscriptions.list).toHaveBeenLastCalledWith({
      page: undefined,
      limit: undefined,
      active: true,
      metadata: { referenceId: organizationId },
      external_customer_id: outsider.user.id,
    })
    expect(harness.warn).not.toHaveBeenCalled()
  })

  it('still lists a subscription for the user who purchased it after they leave the organization', async () => {
    const harness = createHarness()
    const owner = await harness.signUp('owner')
    const purchaser = await harness.signUp('purchaser')
    const { id: organizationId } = await harness.createOrganization(
      owner.cookie,
    )
    const subscription = harness.seedSubscriptions(
      organizationId,
      purchaser.user.id,
    )

    const result = await harness.listSubscriptions(
      purchaser.cookie,
      organizationId,
    )

    expect(result.body.items).toEqual([subscription])
  })

  it.each([
    ['with the organization plugin', true],
    ['without the organization plugin', false],
  ])(
    'removes billing details for a custom reference %s',
    async (_, organizationPlugin) => {
      const harness = createHarness({ organizationPlugin })
      const purchaser = await harness.signUp('purchaser')
      const teammate = await harness.signUp('teammate')
      const subscription = harness.seedSubscriptions(
        'workspace-123',
        purchaser.user.id,
      )

      const purchaserResult = await harness.listSubscriptions(
        purchaser.cookie,
        'workspace-123',
      )
      expect(purchaserResult.body.items).toEqual([subscription])

      const teammateResult = await harness.listSubscriptions(
        teammate.cookie,
        'workspace-123',
      )
      expect(teammateResult.status).toBe(200)
      expect(teammateResult.body.items).toEqual([
        entitlementSubscription('workspace-123'),
      ])
      expect(harness.warn).toHaveBeenCalledTimes(1)
      expect(harness.warn).toHaveBeenCalledWith(
        expect.stringContaining('authorizeReference'),
      )
    },
  )

  it("does not list another user's subscriptions by their user ID", async () => {
    const harness = createHarness({ organizationPlugin: false })
    const purchaser = await harness.signUp('purchaser')
    const other = await harness.signUp('other')
    const subscription = harness.seedSubscriptions(
      purchaser.user.id,
      purchaser.user.id,
    )

    const purchaserResult = await harness.listSubscriptions(
      purchaser.cookie,
      purchaser.user.id,
    )
    expect(purchaserResult.body.items).toEqual([subscription])

    const otherResult = await harness.listSubscriptions(
      other.cookie,
      purchaser.user.id,
    )
    expect(otherResult.status).toBe(200)
    expect(otherResult.body.items).toEqual([])
    expect(harness.warn).not.toHaveBeenCalled()
  })

  it('authorizes custom references with authorizeReference', async () => {
    const workspaceMembers = new Map<string, 'admin' | 'member'>()
    const harness = createHarness({
      authorizeReference: ({ user, referenceType, defaultAccess }) => {
        if (referenceType !== 'unknown') return defaultAccess
        const role = workspaceMembers.get(user.id)
        if (!role) return false
        return role === 'admin' ? 'billing' : 'entitlements'
      },
    })
    const purchaser = await harness.signUp('purchaser')
    const admin = await harness.signUp('admin')
    const member = await harness.signUp('member')
    const outsider = await harness.signUp('outsider')
    workspaceMembers.set(admin.user.id, 'admin')
    workspaceMembers.set(member.user.id, 'member')
    const subscription = harness.seedSubscriptions(
      'workspace-123',
      purchaser.user.id,
    )

    const adminResult = await harness.listSubscriptions(
      admin.cookie,
      'workspace-123',
    )
    expect(adminResult.body.items).toEqual([subscription])

    const memberResult = await harness.listSubscriptions(
      member.cookie,
      'workspace-123',
    )
    expect(memberResult.body.items).toEqual([
      entitlementSubscription('workspace-123'),
    ])

    harness.client.subscriptions.list.mockClear()
    const outsiderResult = await harness.listSubscriptions(
      outsider.cookie,
      'workspace-123',
    )
    expect(outsiderResult.status).toBe(403)
    expect(harness.client.subscriptions.list).not.toHaveBeenCalled()
    expect(harness.warn).not.toHaveBeenCalled()
  })
})
