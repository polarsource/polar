import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthenticatedUser, requireAuthenticatedUser } from './user'

const { cookieStore, requestHeaders, get, redirect } = vi.hoisted(() => ({
  cookieStore: { has: vi.fn() },
  requestHeaders: new Headers(),
  get: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))

vi.mock('next/headers', () => ({
  cookies: async () => cookieStore,
  headers: async () => requestHeaders,
}))

vi.mock('next/navigation', () => ({ redirect }))

vi.mock('./client/serverside', () => ({
  getServerSideAPI: async () => ({ GET: get }),
}))

const respondWith = (status: number, data?: unknown) =>
  get.mockResolvedValue({
    data,
    response: { ok: status < 400, status, headers: new Headers() },
  })

describe('getAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieStore.has.mockReturnValue(true)
  })

  it('returns nothing without calling the API when there is no session cookie', async () => {
    cookieStore.has.mockReturnValue(false)

    expect(await getAuthenticatedUser()).toBeUndefined()
    expect(get).not.toHaveBeenCalled()
  })

  it('returns the user the API resolves from the session', async () => {
    const user = { id: '123', email: 'test@example.com' }
    respondWith(200, user)

    expect(await getAuthenticatedUser()).toEqual(user)
    expect(get).toHaveBeenCalledWith('/v1/users/me', { cache: 'no-store' })
  })

  it('returns nothing when the API rejects the session', async () => {
    respondWith(401)

    expect(await getAuthenticatedUser()).toBeUndefined()
  })

  it('returns nothing when resolving the session is rate-limited', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    respondWith(429)

    expect(await getAuthenticatedUser()).toBeUndefined()
    consoleErrorSpy.mockRestore()
  })

  it('throws on an unexpected API response status', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    respondWith(500)

    await expect(getAuthenticatedUser()).rejects.toThrow(
      'Unexpected response status while fetching authenticated user',
    )
    consoleErrorSpy.mockRestore()
  })
})

describe('requireAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieStore.has.mockReturnValue(true)
  })

  it('redirects to login, back to the requested page, when the session cookie is no longer valid', async () => {
    respondWith(401)
    requestHeaders.set('x-polar-request-path', '/dashboard/acme?tab=orders')

    await expect(requireAuthenticatedUser()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith(
      '/auth?return_to=%2Fdashboard%2Facme%3Ftab%3Dorders',
    )
    requestHeaders.delete('x-polar-request-path')
  })

  it('redirects to login without a return path when none was forwarded', async () => {
    respondWith(401)

    await expect(requireAuthenticatedUser()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/auth')
  })

  it('returns the user when the session is valid', async () => {
    const user = { id: '123', email: 'test@example.com' }
    respondWith(200, user)

    expect(await requireAuthenticatedUser()).toEqual(user)
    expect(redirect).not.toHaveBeenCalled()
  })
})
