import type { refreshAsync } from 'expo-auth-session'
import type * as RefresherModule from './refresher'
import type * as RefreshMiddlewareModule from './refreshMiddleware'

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
let refreshMiddleware: (typeof RefreshMiddlewareModule)['refreshMiddleware']

const NOW = new Date('2024-01-01T00:00:00Z').getTime()

const buildTokenResponse = (
  overrides: Partial<{
    accessToken: string
    refreshToken: string
    expiresIn: number
  }> = {},
) =>
  ({
    accessToken: 'AT_NEW',
    refreshToken: 'RT_NEW',
    expiresIn: 60,
    ...overrides,
  }) as unknown as Awaited<ReturnType<typeof refreshAsync>>

const buildRequest = (
  url: string,
  init: RequestInit & { authToken?: string } = {},
): Request => {
  const { authToken, ...rest } = init
  const headers = new Headers(rest.headers ?? {})
  if (authToken !== undefined) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }
  return new Request(url, { ...rest, headers })
}

const middlewareOptions = {
  baseUrl: 'http://127.0.0.1:8000',
  parseAs: 'json' as const,
  querySerializer: () => '',
  bodySerializer: () => '',
  fetch: jest.fn() as jest.MockedFunction<typeof fetch>,
}

const callOnRequest = async (request: Request) => {
  if (typeof refreshMiddleware.onRequest !== 'function') {
    throw new Error('onRequest is not defined on the middleware')
  }
  return await refreshMiddleware.onRequest({
    request,
    schemaPath: '/v1/foo',
    params: {},
    options: middlewareOptions,
    id: 'test-id',
  })
}

const callOnResponse = async (request: Request, response: Response) => {
  if (typeof refreshMiddleware.onResponse !== 'function') {
    throw new Error('onResponse is not defined on the middleware')
  }
  return await refreshMiddleware.onResponse({
    request,
    response,
    schemaPath: '/v1/foo',
    params: {},
    options: middlewareOptions,
    id: 'test-id',
  })
}

const configureFresh = () => {
  configureRefresher({
    accessToken: 'AT_OLD',
    refreshToken: 'RT_OLD',
    expiresAt: NOW + 60_000,
    setSession: jest.fn(),
  })
}

const configureStale = () => {
  configureRefresher({
    accessToken: 'AT_OLD',
    refreshToken: 'RT_OLD',
    expiresAt: NOW + 60_000,
    setSession: jest.fn(),
  })
  jest.setSystemTime(NOW + 50_000)
}

beforeEach(() => {
  jest.resetModules()
  ;({ configureRefresher } = require('./refresher') as typeof RefresherModule)
  ;({ refreshMiddleware } =
    require('./refreshMiddleware') as typeof RefreshMiddlewareModule)
  mockRefreshAsync.mockReset()
  middlewareOptions.fetch.mockReset()
  jest.useFakeTimers().setSystemTime(NOW)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('onRequest (proactive refresh)', () => {
  it('returns undefined when no refresh token is configured', async () => {
    const request = buildRequest('http://127.0.0.1:8000/v1/orgs', {
      authToken: 'AT_OLD',
    })
    const result = await callOnRequest(request)
    expect(result).toBeUndefined()
    expect(mockRefreshAsync).not.toHaveBeenCalled()
  })

  it('returns undefined when the token is fresh', async () => {
    configureFresh()
    const request = buildRequest('http://127.0.0.1:8000/v1/orgs', {
      authToken: 'AT_OLD',
    })
    const result = await callOnRequest(request)
    expect(result).toBeUndefined()
    expect(mockRefreshAsync).not.toHaveBeenCalled()
  })

  it('rewrites Authorization when fresh but the request still carries a stale bearer', async () => {
    configureFresh()
    configureRefresher({
      accessToken: 'AT_CURRENT',
      refreshToken: 'RT_OLD',
      expiresAt: NOW + 60_000,
      setSession: jest.fn(),
    })

    const request = buildRequest('http://127.0.0.1:8000/v1/orgs', {
      authToken: 'AT_STALE',
    })
    const result = await callOnRequest(request)

    expect(result).toBeInstanceOf(Request)
    const next = result as Request
    expect(next.headers.get('Authorization')).toBe('Bearer AT_CURRENT')
    expect(mockRefreshAsync).not.toHaveBeenCalled()
  })

  it('skips the token endpoint to avoid recursive refresh', async () => {
    configureStale()
    const request = buildRequest('http://127.0.0.1:8000/v1/oauth2/token', {
      authToken: 'AT_OLD',
    })
    const result = await callOnRequest(request)
    expect(result).toBeUndefined()
    expect(mockRefreshAsync).not.toHaveBeenCalled()
  })

  it('skips the revoke endpoint to avoid recursive refresh', async () => {
    configureStale()
    const request = buildRequest('http://127.0.0.1:8000/v1/oauth2/revoke', {
      authToken: 'AT_OLD',
    })
    const result = await callOnRequest(request)
    expect(result).toBeUndefined()
    expect(mockRefreshAsync).not.toHaveBeenCalled()
  })

  it('refreshes for /v1/oauth2/userinfo when stale (it is a normal bearer-protected endpoint)', async () => {
    configureStale()
    mockRefreshAsync.mockResolvedValueOnce(
      buildTokenResponse({ accessToken: 'AT_NEW' }),
    )

    const request = buildRequest('http://127.0.0.1:8000/v1/oauth2/userinfo', {
      authToken: 'AT_OLD',
    })
    const result = await callOnRequest(request)

    expect(result).toBeInstanceOf(Request)
    const next = result as Request
    expect(next.headers.get('Authorization')).toBe('Bearer AT_NEW')
    expect(next.url).toBe('http://127.0.0.1:8000/v1/oauth2/userinfo')
    expect(mockRefreshAsync).toHaveBeenCalledTimes(1)
  })

  it('refreshes and returns a new Request with the new auth header when stale', async () => {
    configureStale()
    mockRefreshAsync.mockResolvedValueOnce(
      buildTokenResponse({ accessToken: 'AT_NEW' }),
    )

    const request = buildRequest('http://127.0.0.1:8000/v1/orgs', {
      authToken: 'AT_OLD',
    })
    const result = await callOnRequest(request)

    expect(result).toBeInstanceOf(Request)
    const next = result as Request
    expect(next.headers.get('Authorization')).toBe('Bearer AT_NEW')
    expect(next.url).toBe('http://127.0.0.1:8000/v1/orgs')
    expect(mockRefreshAsync).toHaveBeenCalledTimes(1)
  })

  it('returns undefined when the proactive refresh fails', async () => {
    configureStale()
    mockRefreshAsync.mockRejectedValueOnce(new Error('refresh failed'))

    const request = buildRequest('http://127.0.0.1:8000/v1/orgs', {
      authToken: 'AT_OLD',
    })
    const result = await callOnRequest(request)
    expect(result).toBeUndefined()
  })
})

describe('onResponse (reactive refresh)', () => {
  it('returns undefined for non-401 responses', async () => {
    configureFresh()
    const request = buildRequest('http://127.0.0.1:8000/v1/orgs', {
      authToken: 'AT_OLD',
    })
    const response = new Response('{}', { status: 200 })
    const result = await callOnResponse(request, response)
    expect(result).toBeUndefined()
    expect(mockRefreshAsync).not.toHaveBeenCalled()
  })

  it('returns undefined for 401 from the token endpoint (refresh itself failed)', async () => {
    configureFresh()
    const request = buildRequest('http://127.0.0.1:8000/v1/oauth2/token', {
      authToken: 'AT_OLD',
    })
    const response = new Response('{}', { status: 401 })
    const result = await callOnResponse(request, response)
    expect(result).toBeUndefined()
    expect(mockRefreshAsync).not.toHaveBeenCalled()
  })

  it('on 401 from /v1/oauth2/userinfo, refreshes and retries (it is a normal bearer-protected endpoint)', async () => {
    configureFresh()
    mockRefreshAsync.mockResolvedValueOnce(
      buildTokenResponse({ accessToken: 'AT_NEW' }),
    )
    const retryResponse = new Response('{}', { status: 200 })
    middlewareOptions.fetch.mockResolvedValueOnce(retryResponse)

    const request = buildRequest('http://127.0.0.1:8000/v1/oauth2/userinfo', {
      authToken: 'AT_OLD',
    })
    const response = new Response('{}', { status: 401 })

    const result = await callOnResponse(request, response)

    expect(mockRefreshAsync).toHaveBeenCalledTimes(1)
    expect(middlewareOptions.fetch).toHaveBeenCalledTimes(1)
    const retried = middlewareOptions.fetch.mock.calls[0][0] as Request
    expect(retried.headers.get('Authorization')).toBe('Bearer AT_NEW')
    expect(retried.url).toBe('http://127.0.0.1:8000/v1/oauth2/userinfo')
    expect(result).toBe(retryResponse)
  })

  it('returns undefined for 401 when no refresh token is available', async () => {
    const request = buildRequest('http://127.0.0.1:8000/v1/orgs', {
      authToken: 'AT_OLD',
    })
    const response = new Response('{}', { status: 401 })
    const result = await callOnResponse(request, response)
    expect(result).toBeUndefined()
    expect(mockRefreshAsync).not.toHaveBeenCalled()
  })

  it('on 401, refreshes and retries the request with the new token', async () => {
    configureFresh()
    mockRefreshAsync.mockResolvedValueOnce(
      buildTokenResponse({ accessToken: 'AT_NEW' }),
    )
    const retryResponse = new Response('{}', { status: 200 })
    middlewareOptions.fetch.mockResolvedValueOnce(retryResponse)

    const request = buildRequest('http://127.0.0.1:8000/v1/orgs', {
      authToken: 'AT_OLD',
    })
    const response = new Response('{}', { status: 401 })

    const result = await callOnResponse(request, response)

    expect(mockRefreshAsync).toHaveBeenCalledTimes(1)
    expect(middlewareOptions.fetch).toHaveBeenCalledTimes(1)
    const retried = middlewareOptions.fetch.mock.calls[0][0] as Request
    expect(retried.headers.get('Authorization')).toBe('Bearer AT_NEW')
    expect(retried.url).toBe('http://127.0.0.1:8000/v1/orgs')
    expect(result).toBe(retryResponse)
  })

  it('does not retry when refresh itself fails', async () => {
    configureFresh()
    mockRefreshAsync.mockRejectedValueOnce(new Error('rt revoked'))

    const request = buildRequest('http://127.0.0.1:8000/v1/orgs', {
      authToken: 'AT_OLD',
    })
    const response = new Response('{}', { status: 401 })

    const result = await callOnResponse(request, response)

    expect(result).toBeUndefined()
    expect(middlewareOptions.fetch).not.toHaveBeenCalled()
  })
})
