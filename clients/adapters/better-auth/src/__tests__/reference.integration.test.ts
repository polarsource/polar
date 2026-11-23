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

const createHarness = (authorizeReference?: AuthorizeReference) => {
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
  const auth: any = betterAuth({
    baseURL,
    secret: 'better-auth-secret-that-is-long-enough-for-tests',
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    plugins: [
      organization(),
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

  return { auth, client, signUp, listSubscriptions }
}

describe('reference_id subscription access', () => {
  it('keeps the documented entitlement check working for a plain organization member', async () => {
    const { auth, client, signUp, listSubscriptions } = createHarness()
    const owner = await signUp('owner')
    const member = await signUp('member')
    const headers = new Headers({ cookie: owner.cookie })
    const { id: organizationId } = (await auth.api.createOrganization({
      headers,
      body: { name: 'Acme', slug: 'acme' },
    })) as { id: string }
    await auth.api.addMember({
      headers,
      body: { organizationId, userId: member.user.id, role: 'member' },
    })
    const subscription = {
      id: 'subscription-123',
      status: 'active',
      product_id: 'product-pro',
      metadata: { referenceId: organizationId, internalNote: 'VIP' },
      customer: {
        id: 'customer-123',
        external_id: owner.user.id,
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
    vi.mocked(client.subscriptions.list).mockResolvedValue({
      items: [subscription],
      pagination: { total_count: 1, max_page: 1 },
    })

    const ownerResult = await listSubscriptions(owner.cookie, organizationId)
    expect(ownerResult.body.items).toEqual([subscription])

    const memberResult = await listSubscriptions(member.cookie, organizationId)
    expect(memberResult.status).toBe(200)
    expect(
      memberResult.body.items.some(
        (item) => item['product_id'] === 'product-pro',
      ),
    ).toBe(true)
    expect(memberResult.body.items).toEqual([
      {
        id: 'subscription-123',
        status: 'active',
        product_id: 'product-pro',
        metadata: { referenceId: organizationId },
        product: {
          id: 'product-pro',
          name: 'Pro',
          benefits: [{ id: 'benefit-123' }],
        },
        prices: [],
        meters: [],
      },
    ])
  })

  it('rejects the request without calling Polar when authorizeReference denies it', async () => {
    const { client, signUp, listSubscriptions } = createHarness(() => false)
    const user = await signUp('user')

    const result = await listSubscriptions(user.cookie, 'workspace-123')

    expect(result.status).toBe(403)
    expect(client.subscriptions.list).not.toHaveBeenCalled()
  })
})
