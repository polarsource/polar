import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/config', () => ({
  CONFIG: {
    BASE_URL: 'http://api.polar.test',
    AUTH_MCP_COOKIE_KEY: 'polar_mcp_session',
  },
}))

vi.mock('@/utils/mcp-session', () => ({
  MCP_ORG_COOKIE_KEY: 'polar_mcp_session_org',
}))

import { GET } from './route'

describe('GET /api/mcp-logout', () => {
  const parseSetCookies = (response: Response): string[] =>
    response.headers.getSetCookie?.() ?? []

  it('redirects to the server-side logout endpoint', async () => {
    const response = await GET()
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      'http://api.polar.test/v1/auth/logout',
    )
    expect(response.headers.get('Location')).not.toContain('polar_session')
  })

  it('sets a maxAge=0 Set-Cookie for the MCP token cookie', async () => {
    const response = await GET()
    const setCookies = parseSetCookies(response)
    expect(setCookies.length).toBe(2)

    const tokenCookie = setCookies.find((c) =>
      c.startsWith('polar_mcp_session='),
    )
    expect(tokenCookie).toBeDefined()
    expect(tokenCookie).toMatch(/Max-Age=0/)
    expect(tokenCookie).toMatch(/HttpOnly/)
    expect(tokenCookie).toMatch(/Secure/)
    expect(tokenCookie).toMatch(/Path=\/;/)
  })

  it('sets a maxAge=0 Set-Cookie for the MCP org cookie', async () => {
    const response = await GET()
    const setCookies = parseSetCookies(response)
    const orgCookie = setCookies.find((c) =>
      c.startsWith('polar_mcp_session_org='),
    )
    expect(orgCookie).toBeDefined()
    expect(orgCookie).toMatch(/Max-Age=0/)
    expect(orgCookie).toMatch(/HttpOnly/)
  })

  it('does not throw and produces exactly two Set-Cookie headers', async () => {
    const response = await GET()
    expect(parseSetCookies(response)).toHaveLength(2)
  })
})
