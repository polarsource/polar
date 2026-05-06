import type { refreshAsync } from 'expo-auth-session'
import { TokenError } from 'expo-auth-session'
import type * as RefresherModule from './refresher'

const mockRefreshAsync = jest.fn<
  ReturnType<typeof refreshAsync>,
  Parameters<typeof refreshAsync>
>()

jest.mock('expo-auth-session', () => {
  const actual =
    jest.requireActual<typeof import('expo-auth-session')>('expo-auth-session')
  return {
    ...actual,
    refreshAsync: mockRefreshAsync,
  }
})

let configureRefresher: (typeof RefresherModule)['configureRefresher']
let hasRefreshToken: (typeof RefresherModule)['hasRefreshToken']
let isAccessTokenStale: (typeof RefresherModule)['isAccessTokenStale']
let refreshAccessToken: (typeof RefresherModule)['refreshAccessToken']

const NOW = new Date('2024-01-01T00:00:00Z').getTime()

const buildTokenResponse = (
  overrides: Partial<{
    accessToken: string
    refreshToken: string | undefined
    expiresIn: number | undefined
  }> = {},
) =>
  ({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresIn: 60,
    ...overrides,
  }) as unknown as Awaited<ReturnType<typeof refreshAsync>>

const configure = (
  overrides: Partial<{
    accessToken: string | null
    refreshToken: string | null
    expiresAt: number | null
    setSession: jest.Mock
  }> = {},
) => {
  const setSession = overrides.setSession ?? jest.fn()
  configureRefresher({
    accessToken: overrides.accessToken ?? 'access-token',
    refreshToken:
      overrides.refreshToken !== undefined
        ? overrides.refreshToken
        : 'refresh-token',
    expiresAt:
      overrides.expiresAt !== undefined ? overrides.expiresAt : NOW + 60_000,
    setSession,
  })
  return { setSession }
}

beforeEach(() => {
  jest.resetModules()
  ;({
    configureRefresher,
    hasRefreshToken,
    isAccessTokenStale,
    refreshAccessToken,
  } = require('./refresher') as typeof RefresherModule)
  mockRefreshAsync.mockReset()
  jest.useFakeTimers().setSystemTime(NOW)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('hasRefreshToken', () => {
  it('returns false when no refresh token is configured', () => {
    expect(hasRefreshToken()).toBe(false)
  })

  it('returns true when a refresh token is configured', () => {
    configure({ refreshToken: 'rt' })
    expect(hasRefreshToken()).toBe(true)
  })

  it('returns false when refresh token is explicitly null', () => {
    configure({ refreshToken: null })
    expect(hasRefreshToken()).toBe(false)
  })
})

describe('isAccessTokenStale', () => {
  it('returns false when no refresh token is configured', () => {
    expect(isAccessTokenStale()).toBe(false)
  })

  it('returns false when no expiresAt is set', () => {
    configure({ expiresAt: null })
    expect(isAccessTokenStale()).toBe(false)
  })

  describe('with adaptive margin', () => {
    it('with a 60s lifetime, treats 30s remaining as fresh (margin = 20s)', () => {
      configure({ expiresAt: NOW + 60_000 })
      jest.setSystemTime(NOW + 30_000)
      expect(isAccessTokenStale()).toBe(false)
    })

    it('with a 60s lifetime, treats 15s remaining as stale (margin = 20s)', () => {
      configure({ expiresAt: NOW + 60_000 })
      jest.setSystemTime(NOW + 45_000)
      expect(isAccessTokenStale()).toBe(true)
    })

    it('with a 60s lifetime, treats already-expired token as stale', () => {
      configure({ expiresAt: NOW + 60_000 })
      jest.setSystemTime(NOW + 90_000)
      expect(isAccessTokenStale()).toBe(true)
    })
  })

  describe('with margin clamping', () => {
    it('clamps margin to 60s ceiling for very long lifetimes', async () => {
      configure({ expiresAt: NOW + 3_600_000 })

      mockRefreshAsync.mockResolvedValueOnce(
        buildTokenResponse({ expiresIn: 3_600 }),
      )
      await refreshAccessToken()

      configure({ expiresAt: NOW + 90_000 })

      expect(isAccessTokenStale()).toBe(false)

      jest.setSystemTime(NOW + 31_000)
      expect(isAccessTokenStale()).toBe(true)
    })

    it('clamps margin to 1s floor for very short lifetimes', async () => {
      configure({ expiresAt: NOW + 2_000 })
      mockRefreshAsync.mockResolvedValueOnce(
        buildTokenResponse({ expiresIn: 2 }),
      )
      await refreshAccessToken()

      expect(isAccessTokenStale()).toBe(false)

      jest.setSystemTime(NOW + 1_100)
      expect(isAccessTokenStale()).toBe(true)
    })
  })

  describe('with unknown lifetime', () => {
    it('falls back to 60s margin when no lifetime has been observed', () => {
      configure({ expiresAt: NOW - 1_000 })

      expect(isAccessTokenStale()).toBe(true)
    })

    it('estimates lifetime from a future expiresAt at first configure', () => {
      configure({ expiresAt: NOW + 30_000 })

      expect(isAccessTokenStale()).toBe(false)

      jest.setSystemTime(NOW + 20_001)
      expect(isAccessTokenStale()).toBe(true)
    })

    it('does not record a lifetime when configured with an expired token (cold start path)', () => {
      configure({ expiresAt: NOW - 5_000 })
      configure({ expiresAt: NOW + 30_000 })

      expect(isAccessTokenStale()).toBe(false)

      jest.setSystemTime(NOW + 20_001)
      expect(isAccessTokenStale()).toBe(true)
    })
  })
})

describe('refreshAccessToken response handling', () => {
  it('handles a response missing expiresIn gracefully (no lifetime poisoning)', async () => {
    const { setSession } = configure()
    mockRefreshAsync.mockResolvedValueOnce(
      buildTokenResponse({ expiresIn: undefined }),
    )

    await refreshAccessToken()

    expect(setSession).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    )

    expect(isAccessTokenStale()).toBe(false)
  })
})

describe('refreshAccessToken', () => {
  it('returns null when no refresh token is configured', async () => {
    const setSession = jest.fn()
    configure({ refreshToken: null, setSession })
    const result = await refreshAccessToken()
    expect(result).toBeNull()
    expect(mockRefreshAsync).not.toHaveBeenCalled()
    expect(setSession).not.toHaveBeenCalled()
  })

  it('returns null when no setSession is configured', async () => {
    const result = await refreshAccessToken()
    expect(result).toBeNull()
    expect(mockRefreshAsync).not.toHaveBeenCalled()
  })

  it('on success, returns new access token and persists the new bundle', async () => {
    const { setSession } = configure({ refreshToken: 'old-rt' })
    mockRefreshAsync.mockResolvedValueOnce(
      buildTokenResponse({
        accessToken: 'AT_NEW',
        refreshToken: 'RT_NEW',
        expiresIn: 60,
      }),
    )

    const result = await refreshAccessToken()

    expect(result).toBe('AT_NEW')
    expect(mockRefreshAsync).toHaveBeenCalledTimes(1)
    expect(mockRefreshAsync).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'old-rt' }),
      expect.any(Object),
    )
    expect(setSession).toHaveBeenCalledWith({
      accessToken: 'AT_NEW',
      refreshToken: 'RT_NEW',
      expiresAt: NOW + 60_000,
    })
  })

  it('falls back to the existing refresh token if the response omits one', async () => {
    const { setSession } = configure({ refreshToken: 'old-rt' })
    mockRefreshAsync.mockResolvedValueOnce(
      buildTokenResponse({ refreshToken: undefined }),
    )

    await refreshAccessToken()

    expect(setSession).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'old-rt' }),
    )
  })

  it('updates state so subsequent isAccessTokenStale uses the new lifetime', async () => {
    configure({ expiresAt: NOW + 10_000 })
    mockRefreshAsync.mockResolvedValueOnce(
      buildTokenResponse({ expiresIn: 3_600 }),
    )
    await refreshAccessToken()

    jest.setSystemTime(NOW + 3_550_000)

    expect(isAccessTokenStale()).toBe(true)
  })

  it('on transport failure, returns null without clearing the session', async () => {
    const { setSession } = configure()
    mockRefreshAsync.mockRejectedValueOnce(new Error('refresh denied'))

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    expect(setSession).not.toHaveBeenCalledWith(null)
    expect(hasRefreshToken()).toBe(true)
  })

  it('on invalid_grant TokenError, clears session and returns null', async () => {
    const { setSession } = configure()
    mockRefreshAsync.mockRejectedValueOnce(
      new TokenError({ error: 'invalid_grant' }),
    )

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    expect(setSession).toHaveBeenCalledWith(null)
    expect(hasRefreshToken()).toBe(false)
  })

  it('on invalid_request TokenError, returns null without clearing the session', async () => {
    const { setSession } = configure()
    mockRefreshAsync.mockRejectedValueOnce(
      new TokenError({ error: 'invalid_request' }),
    )

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    expect(setSession).not.toHaveBeenCalledWith(null)
    expect(hasRefreshToken()).toBe(true)
  })

  describe('concurrency dedup', () => {
    it('shares a single in-flight refresh across N concurrent callers', async () => {
      configure()
      let resolveRefresh!: (
        value: Awaited<ReturnType<typeof refreshAsync>>,
      ) => void
      const refreshPromise = new Promise<
        Awaited<ReturnType<typeof refreshAsync>>
      >((resolve) => {
        resolveRefresh = resolve
      })
      mockRefreshAsync.mockReturnValueOnce(refreshPromise)

      const callers = [
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
      ]

      expect(mockRefreshAsync).toHaveBeenCalledTimes(1)

      resolveRefresh(buildTokenResponse({ accessToken: 'shared-AT' }))
      const results = await Promise.all(callers)

      expect(results).toEqual([
        'shared-AT',
        'shared-AT',
        'shared-AT',
        'shared-AT',
      ])
    })

    it('clears the in-flight slot after success so a subsequent refresh can fire', async () => {
      configure()
      mockRefreshAsync
        .mockResolvedValueOnce(buildTokenResponse({ accessToken: 'AT_1' }))
        .mockResolvedValueOnce(buildTokenResponse({ accessToken: 'AT_2' }))

      expect(await refreshAccessToken()).toBe('AT_1')
      expect(await refreshAccessToken()).toBe('AT_2')
      expect(mockRefreshAsync).toHaveBeenCalledTimes(2)
    })

    it('clears the in-flight slot after failure so a subsequent refresh can fire', async () => {
      configure()
      mockRefreshAsync
        .mockRejectedValueOnce(new Error('first call fails'))
        .mockResolvedValueOnce(buildTokenResponse({ accessToken: 'AT_2' }))

      expect(await refreshAccessToken()).toBeNull()

      configure()
      expect(await refreshAccessToken()).toBe('AT_2')
    })
  })
})

describe('configureRefresher lifetime estimation', () => {
  it('estimates lifetime from expiresAt on the first configure call', () => {
    configure({ expiresAt: NOW + 30_000 })

    jest.setSystemTime(NOW + 19_000)
    expect(isAccessTokenStale()).toBe(false)

    jest.setSystemTime(NOW + 21_000)
    expect(isAccessTokenStale()).toBe(true)
  })

  it('does not overwrite a known lifetime on subsequent configure calls', async () => {
    configure({ expiresAt: NOW + 120_000 })
    mockRefreshAsync.mockResolvedValueOnce(
      buildTokenResponse({ expiresIn: 3_600 }),
    )
    await refreshAccessToken()

    configureRefresher({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: NOW + 120_000,
      setSession: jest.fn(),
    })

    jest.setSystemTime(NOW + 61_100)

    expect(isAccessTokenStale()).toBe(true)
  })
})
