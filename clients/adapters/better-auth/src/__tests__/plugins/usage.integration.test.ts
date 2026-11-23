import { betterAuth } from 'better-auth'
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory'
import { describe, expect, it, vi } from 'vitest'
import { usage } from '../../plugins/usage'
import { polar } from '../../server'
import { createMockPolarClient } from '../utils/mocks'

const baseURL = 'http://localhost:3000'

const createHarness = () => {
  const database: MemoryDB = {
    user: [],
    session: [],
    account: [],
    verification: [],
  }
  const client = createMockPolarClient()
  vi.mocked(client.events.ingest).mockResolvedValue({ inserted: 1 } as any)

  const auth = betterAuth({
    baseURL,
    secret: 'better-auth-secret-that-is-long-enough-for-tests',
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    plugins: [polar({ client, createCustomerOnSignUp: false, use: [usage()] })],
  })

  const post = (path: string, body: unknown, cookie?: string) =>
    auth.handler(
      new Request(`${baseURL}/api/auth${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      }),
    )

  const signUp = async () => {
    const response = await post('/sign-up/email', {
      email: 'user@example.com',
      password: 'password-123',
      name: 'User',
    })
    const sessionCookie = response.headers
      .get('set-cookie')
      ?.match(/better-auth\.session_token=[^;,]+/)?.[0]
    if (!sessionCookie) {
      throw new Error('Sign-up returned no Better Auth session cookie')
    }
    const { user } = (await response.json()) as { user: { id: string } }
    return { sessionCookie, user }
  }

  return { auth, client, post, signUp }
}

describe('usage ingestion', () => {
  it('is not reachable over HTTP', async () => {
    const { client, post, signUp } = createHarness()
    const { sessionCookie } = await signUp()

    const response = await post(
      '/usage/ingest',
      { event: 'api_call', metadata: { tokens: -1000 } },
      sessionCookie,
    )

    expect(response.status).toBe(404)
    expect(client.events.ingest).not.toHaveBeenCalled()
  })

  it('ingests for the session user when called from the server', async () => {
    const { auth, client, signUp } = createHarness()
    const { sessionCookie, user } = await signUp()

    await auth.api.ingestUsage({
      headers: new Headers({ cookie: sessionCookie }),
      body: { event: 'api_call', metadata: { tokens: 42 } },
    })

    expect(client.events.ingest).toHaveBeenCalledWith({
      events: [
        {
          name: 'api_call',
          metadata: { tokens: 42 },
          external_customer_id: user.id,
        },
      ],
    })
  })

  it('requires a session', async () => {
    const { auth, client } = createHarness()

    await expect(
      auth.api.ingestUsage({
        headers: new Headers(),
        body: { event: 'api_call', metadata: {} },
      }),
    ).rejects.toMatchObject({ statusCode: 401 })
    expect(client.events.ingest).not.toHaveBeenCalled()
  })
})
