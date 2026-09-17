import { createPolarCore } from '@polar-sh/sdk/2026-04'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureTeamCustomer } from '../organization/sync'
import { portal } from '../plugins/portal'

vi.unmock('@polar-sh/sdk/2026-04/services/customers')
vi.unmock('@polar-sh/sdk/2026-04/services/customer_sessions')
vi.unmock('@polar-sh/sdk/2026-04/services/customer_portal/benefit_grants')

vi.mock('better-auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('better-auth/api')>()),
  createAuthEndpoint: (_path: string, _options: unknown, handler: unknown) =>
    handler,
}))

afterEach(() => vi.unstubAllGlobals())

describe('SDK transport', () => {
  it('preserves not-found handling and team customer creation with a core client', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ detail: 'Not found' }, { status: 404 }),
      )
      .mockResolvedValueOnce(Response.json({ id: 'customer-123' }))
    vi.stubGlobal('fetch', fetch)

    await ensureTeamCustomer(
      createPolarCore({ accessToken: 'test-token', environment: 'sandbox' }),
      { enabled: true },
      {
        organization: {
          id: 'org-123',
          name: 'Example',
          slug: 'example',
          createdAt: new Date(),
        },
        owner: {
          id: 'user-123',
          name: 'Owner',
          email: 'owner@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    )

    expect(fetch.mock.calls[0]![0]).toBe(
      'https://sandbox-api.polar.sh/v1/customers/external/org-123',
    )
    const [url, init] = fetch.mock.calls[1]!
    expect(url).toBe('https://sandbox-api.polar.sh/v1/customers/')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      external_id: 'org-123',
      name: 'Example',
      type: 'team',
      owner: {
        external_id: 'user-123',
        name: 'Owner',
        email: 'owner@example.com',
      },
    })
  })

  it('uses the customer session token for portal API requests', async () => {
    const benefits = { items: [], pagination: { total_count: 0, max_page: 1 } }
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ token: 'session-token' }))
      .mockResolvedValueOnce(Response.json(benefits))
    vi.stubGlobal('fetch', fetch)
    const client = createPolarCore({ accessToken: 'organization-token' })
    const endpoints = portal()(client)

    const result = await endpoints.benefits({
      context: {
        session: { user: { id: 'user-123' } },
        logger: { error: vi.fn() },
      },
      query: { page: 2, limit: 10 },
      json: (value: unknown) => value,
    } as never)

    expect(result).toEqual(benefits)
    const [sessionUrl, sessionInit] = fetch.mock.calls[0]!
    expect(sessionUrl).toBe('https://api.polar.sh/v1/customer-sessions/')
    expect(new Headers(sessionInit.headers).get('Authorization')).toBe(
      'Bearer organization-token',
    )
    const [benefitsUrl, benefitsInit] = fetch.mock.calls[1]!
    const url = new URL(benefitsUrl)
    expect(url.origin + url.pathname).toBe(
      'https://api.polar.sh/v1/customer-portal/benefit-grants/',
    )
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('limit')).toBe('10')
    expect(new Headers(benefitsInit.headers).get('Authorization')).toBe(
      'Bearer session-token',
    )
  })
})
