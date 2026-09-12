import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore = new Map<string, string>()
const setSpy = vi.fn((key: string, value: string) => {
  cookieStore.set(key, value)
})

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    has: (key: string) => cookieStore.has(key),
    get: (key: string) =>
      cookieStore.has(key) ? { value: cookieStore.get(key)! } : undefined,
    set: setSpy,
    delete: (key: string) => {
      cookieStore.delete(key)
    },
  })),
}))

const postMock = vi.fn()

vi.mock('@/utils/client/serverside', () => ({
  getServerSideAPI: vi.fn(async () => ({ POST: postMock })),
}))

import {
  generateMCPAccessToken,
  hasMCPSessionForOrganization,
  MCP_ORG_COOKIE_KEY,
} from './mcp-session'

const TOKEN_ORG_A = 'oat-org-a-aaaa'
const TOKEN_ORG_B = 'oat-org-b-bbbb'
const ORG_A = '00000000-0000-0000-0000-00000000000a'
const ORG_B = '00000000-0000-0000-0000-00000000000b'
const USER_SESSION = 'polar-session-token'

const mintResponse = (access_token: string) => ({
  data: { access_token, expires_in: 3600 },
  error: undefined,
})

describe('mcp-session', () => {
  beforeEach(() => {
    cookieStore.clear()
    setSpy.mockClear()
    postMock.mockReset()
    cookieStore.set('polar_session', USER_SESSION)
    postMock.mockResolvedValue(mintResponse(TOKEN_ORG_A))
    vi.stubEnv('MCP_OAUTH2_CLIENT_ID', 'client-id')
    vi.stubEnv('MCP_OAUTH2_CLIENT_SECRET', 'client-secret')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('constants', () => {
    it('MCP_ORG_COOKIE_KEY is derived from AUTH_MCP_COOKIE_KEY', () => {
      expect(MCP_ORG_COOKIE_KEY).toBe('polar_mcp_session_org')
    })
  })

  describe('generateMCPAccessToken', () => {
    it('mints a new token and caches both token + org when no MCP cookie exists', async () => {
      const token = await generateMCPAccessToken(ORG_A)

      expect(token).toBe(TOKEN_ORG_A)
      expect(postMock).toHaveBeenCalledTimes(1)
      const [path, init] = postMock.mock.calls[0]
      expect(path).toBe('/v1/oauth2/token')
      expect(init.body).toMatchObject({
        grant_type: 'web',
        sub_type: 'organization',
        sub: ORG_A,
      })

      expect(setSpy).toHaveBeenCalledTimes(2)
      expect(setSpy).toHaveBeenCalledWith('polar_mcp_session', TOKEN_ORG_A, {
        httpOnly: true,
        secure: true,
        expires: expect.any(Date),
      })
      expect(setSpy).toHaveBeenCalledWith('polar_mcp_session_org', ORG_A, {
        httpOnly: true,
        secure: true,
        expires: expect.any(Date),
      })
    })

    it('forwards the user session cookie as session_token', async () => {
      await generateMCPAccessToken(ORG_A)

      const [, init] = postMock.mock.calls[0]
      expect(init.body.session_token).toBe('polar-session-token')
    })

    it('reuses the cached token when org matches (no mint call)', async () => {
      cookieStore.set('polar_mcp_session', TOKEN_ORG_A)
      cookieStore.set(MCP_ORG_COOKIE_KEY, ORG_A)

      const token = await generateMCPAccessToken(ORG_A)

      expect(token).toBe(TOKEN_ORG_A)
      expect(postMock).not.toHaveBeenCalled()
      expect(setSpy).not.toHaveBeenCalled()
    })

    it('re-mints when the cached org differs from the requested org (the bug)', async () => {
      cookieStore.set('polar_mcp_session', TOKEN_ORG_A)
      cookieStore.set(MCP_ORG_COOKIE_KEY, ORG_A)

      postMock.mockResolvedValueOnce(mintResponse(TOKEN_ORG_B))

      const token = await generateMCPAccessToken(ORG_B)

      expect(token).toBe(TOKEN_ORG_B)
      expect(postMock).toHaveBeenCalledTimes(1)
      const [path, init] = postMock.mock.calls[0]
      expect(path).toBe('/v1/oauth2/token')
      expect(init.body.sub).toBe(ORG_B)
      expect(setSpy).toHaveBeenCalledWith('polar_mcp_session', TOKEN_ORG_B, {
        httpOnly: true,
        secure: true,
        expires: expect.any(Date),
      })
      expect(setSpy).toHaveBeenCalledWith('polar_mcp_session_org', ORG_B, {
        httpOnly: true,
        secure: true,
        expires: expect.any(Date),
      })
    })

    it('re-mints when the org cookie is missing even if the token cookie is present', async () => {
      cookieStore.set('polar_mcp_session', TOKEN_ORG_A)

      const token = await generateMCPAccessToken(ORG_A)

      expect(token).toBe(TOKEN_ORG_A)
      expect(postMock).toHaveBeenCalledTimes(1)
    })

    it('re-mints when the token cookie is missing even if a stale org cookie is present', async () => {
      cookieStore.set(MCP_ORG_COOKIE_KEY, ORG_A)

      const token = await generateMCPAccessToken(ORG_A)

      expect(token).toBe(TOKEN_ORG_A)
      expect(postMock).toHaveBeenCalledTimes(1)
    })

    it('throws when the user session cookie is missing', async () => {
      cookieStore.delete('polar_session')

      await expect(generateMCPAccessToken(ORG_A)).rejects.toThrow(
        'No user session cookie found',
      )
      expect(postMock).not.toHaveBeenCalled()
    })

    it('throws when the OAT mint returns an error', async () => {
      postMock.mockResolvedValueOnce({ data: null, error: { message: 'bad' } })

      await expect(generateMCPAccessToken(ORG_A)).rejects.toThrow(
        'Failed to generate OAT',
      )
    })

    it('throws when the OAT mint returns no access_token', async () => {
      postMock.mockResolvedValueOnce({
        data: { access_token: null, expires_in: 3600 },
        error: undefined,
      })

      await expect(generateMCPAccessToken(ORG_A)).rejects.toThrow(
        'Failed to generate OAT',
      )
    })

    it('round-trips across an org switch A -> B -> A without cross-contamination', async () => {
      postMock
        .mockResolvedValueOnce(mintResponse(TOKEN_ORG_A))
        .mockResolvedValueOnce(mintResponse(TOKEN_ORG_B))
        .mockResolvedValueOnce(mintResponse(TOKEN_ORG_A))

      expect(await generateMCPAccessToken(ORG_A)).toBe(TOKEN_ORG_A)
      expect(await generateMCPAccessToken(ORG_B)).toBe(TOKEN_ORG_B)
      expect(await generateMCPAccessToken(ORG_A)).toBe(TOKEN_ORG_A)

      expect(postMock).toHaveBeenCalledTimes(3)
      const mintedOrgs = postMock.mock.calls.map((c) => c[1].body.sub)
      expect(mintedOrgs).toEqual([ORG_A, ORG_B, ORG_A])
    })
  })

  describe('hasMCPSessionForOrganization', () => {
    it('returns true only when both token and matching-org cookies are set', async () => {
      expect(await hasMCPSessionForOrganization(ORG_A)).toBe(false)

      cookieStore.set('polar_mcp_session', TOKEN_ORG_A)
      cookieStore.set(MCP_ORG_COOKIE_KEY, ORG_A)
      expect(await hasMCPSessionForOrganization(ORG_A)).toBe(true)
    })

    it('returns false when the cached org differs from the requested org', async () => {
      cookieStore.set('polar_mcp_session', TOKEN_ORG_A)
      cookieStore.set(MCP_ORG_COOKIE_KEY, ORG_A)

      expect(await hasMCPSessionForOrganization(ORG_B)).toBe(false)
    })

    it('returns false when the org cookie is missing', async () => {
      cookieStore.set('polar_mcp_session', TOKEN_ORG_A)

      expect(await hasMCPSessionForOrganization(ORG_A)).toBe(false)
    })

    it('returns false when the token cookie is missing', async () => {
      cookieStore.set(MCP_ORG_COOKIE_KEY, ORG_A)

      expect(await hasMCPSessionForOrganization(ORG_A)).toBe(false)
    })
  })
})
