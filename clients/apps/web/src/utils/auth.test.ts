import type { Client } from '@polar-sh/client'
import { describe, expect, it, vi } from 'vitest'
import { checkAuthenticationSession } from './auth'

const makeApi = (
  status: number,
  ok: boolean,
  error?: unknown,
  data?: unknown,
): Client =>
  ({
    GET: vi.fn().mockResolvedValue({
      error,
      data,
      response: { ok, status, headers: new Headers() },
    }),
  }) as unknown as Client

describe('checkAuthenticationSession', () => {
  it('returns null on 429 instead of throwing', async () => {
    // The proxy redirects rate-limited users to /auth, which calls this — so a
    // 429 here must degrade to the login form, not crash the page.
    await expect(
      checkAuthenticationSession(makeApi(429, false)),
    ).resolves.toBeNull()
  })

  it('still throws on unexpected non-OK responses (e.g. 500)', async () => {
    await expect(
      checkAuthenticationSession(makeApi(500, false)),
    ).rejects.toThrow('Unexpected response from /v1/auth/status: 500')
  })

  it('returns null for an InvalidAuthenticationSession error', async () => {
    await expect(
      checkAuthenticationSession(
        makeApi(401, false, { error: 'InvalidAuthenticationSession' }),
      ),
    ).resolves.toBeNull()
  })
})
