import assert from 'node:assert/strict'
import { ChildProcess } from 'node:child_process'
import * as http from 'node:http'
import { afterEach, beforeEach, it, vi } from 'vitest'
import { Effect, Redacted } from 'effect'
import * as browser from 'open'
import {
  browserLogin,
  canonicalLoopbackApiUrl,
  CLIENT_IDS,
  exchange,
  parseCallback,
  refreshSession,
  resolveClientId,
  resolveOAuthTarget,
  WELL_KNOWN_API,
} from '../src/cli/oauth'

vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>()
  return { ...actual, createServer: vi.fn(actual.createServer) }
})
vi.mock('open', () => ({ default: vi.fn() }))

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)

beforeEach(() => {
  vi.stubEnv('VOID_OAUTH_CLIENT_ID', undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('resolves Polar, sandbox, and loopback OAuth targets', async () => {
  assert.deepEqual(await run(resolveOAuthTarget(WELL_KNOWN_API.production)), {
    apiUrl: WELL_KNOWN_API.production,
    webUrl: 'https://polar.sh',
    clientId: CLIENT_IDS.production,
  })
  assert.deepEqual(await run(resolveOAuthTarget(WELL_KNOWN_API.sandbox)), {
    apiUrl: WELL_KNOWN_API.sandbox,
    webUrl: 'https://sandbox.polar.sh',
    clientId: CLIENT_IDS.sandbox,
  })
  assert.deepEqual(await run(resolveOAuthTarget('http://127.0.0.1:8000')), {
    apiUrl: 'http://127.0.0.1:8000',
    webUrl: 'http://127.0.0.1:3000',
    clientId: CLIENT_IDS.local,
  })
  assert.deepEqual(await run(resolveOAuthTarget('http://127.0.0.1:8001')), {
    apiUrl: 'http://127.0.0.1:8000',
    webUrl: 'http://127.0.0.1:3000',
    clientId: CLIENT_IDS.local,
  })
  assert.deepEqual(await run(resolveOAuthTarget('http://127.0.0.1:8101')), {
    apiUrl: 'http://127.0.0.1:8101',
    webUrl: 'http://127.0.0.1:3101',
    clientId: CLIENT_IDS.local,
  })
  assert.equal(
    canonicalLoopbackApiUrl('http://127.0.0.1:8001'),
    'http://127.0.0.1:8000',
  )
  assert.equal(
    canonicalLoopbackApiUrl('https://api.polar.sh'),
    'https://api.polar.sh',
  )
  assert.equal(resolveClientId('https://example.invalid'), undefined)
  await assert.rejects(
    run(resolveOAuthTarget('https://example.invalid')),
    /--web-url and VOID_OAUTH_CLIENT_ID/,
  )
  vi.stubEnv('VOID_OAUTH_CLIENT_ID', 'polar_ci_custom')
  assert.deepEqual(
    await run(
      resolveOAuthTarget('https://example.invalid', 'https://app.example'),
    ),
    {
      apiUrl: 'https://example.invalid',
      webUrl: 'https://app.example',
      clientId: 'polar_ci_custom',
    },
  )
})

it('callback verifies state before accepting codes or OAuth denial', () => {
  const base = 'http://127.0.0.1:3334/oauth/callback'
  assert.equal(
    parseCallback(new URL(`${base}?code=ok&state=wrong`), 'expected').outcome,
    'invalid',
  )
  assert.equal(
    parseCallback(new URL(`${base}?error=access_denied&state=s`), 's').outcome,
    'denied',
  )
  assert.deepEqual(parseCallback(new URL(`${base}?code=ok&state=s`), 's'), {
    outcome: 'success',
    code: 'ok',
  })
})

it('exchange converts seconds to milliseconds and preserves omitted refresh tokens', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ access_token: 'new', expires_in: 3600 }))
  const before = Date.now()
  const previous = {
    accessToken: Redacted.make('old'),
    refreshToken: Redacted.make('refresh'),
    expiresAt: 0,
    scopes: ['void:read'],
  }
  const updated = await run(
    exchange(
      'http://void',
      'client',
      new URLSearchParams({ grant_type: 'refresh_token' }),
      previous,
    ),
  )
  assert.ok(updated.expiresAt >= before + 3600_000)
  assert.ok(updated.expiresAt <= Date.now() + 3600_000)
  assert.equal(Redacted.value(updated.refreshToken!), 'refresh')
  assert.deepEqual(updated.scopes, previous.scopes)
  assert.equal(
    new URL(fetch.mock.calls[0]![0] as string).pathname,
    '/v1/oauth2/token',
  )
})

it('exchange retains rotated credentials', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      access_token: 'new',
      refresh_token: 'rotated',
      expires_in: 60,
      scope: 'void:read void:write',
    }),
  )
  const updated = await run(
    exchange('http://void', 'client', new URLSearchParams(), {
      accessToken: Redacted.make('old'),
      refreshToken: Redacted.make('refresh'),
      expiresAt: 0,
      scopes: [],
    }),
  )
  assert.equal(Redacted.value(updated.refreshToken!), 'rotated')
  assert.deepEqual(updated.scopes, ['void:read', 'void:write'])
})

it.each([400, 401, 500])(
  'OAuth HTTP %s errors never include response secrets',
  async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('secret-token', { status }),
    )
    await assert.rejects(
      run(exchange('http://void', 'client', new URLSearchParams())),
      {
        message:
          status === 500
            ? `OAuth service unavailable (HTTP ${status}). Try again.`
            : 'OAuth authorization rejected. Run void login again.',
      },
    )
  },
)

it('network errors and malformed token responses are sanitized', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(
    new Error('secret-in-network-error'),
  )
  await assert.rejects(
    run(exchange('http://void', 'client', new URLSearchParams())),
    /network request failed/,
  )
  vi.mocked(globalThis.fetch).mockResolvedValue(
    Response.json({ access_token: 'secret-token', expires_in: -1 }),
  )
  await assert.rejects(
    run(exchange('http://void', 'client', new URLSearchParams())),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.ok(!error.message.includes('secret-token'))
      return true
    },
  )
})

it('refresh requires a refresh token', async () => {
  await assert.rejects(
    run(
      refreshSession('http://void', 'client', {
        accessToken: Redacted.make('old'),
        expiresAt: 0,
        scopes: [],
      }),
    ),
    /cannot be refreshed/,
  )
})

it.each([true, false])(
  'closes the callback server after OAuth completion (authorized: %s)',
  async (authorized) => {
    let callbackResponse:
      | { status: number | undefined; type: string | undefined; body: string }
      | undefined
    let browserDone: Promise<void> | undefined
    const server = http.createServer()
    const nativeListen = server.listen.bind(server)
    const listen = vi
      .spyOn(server, 'listen')
      .mockImplementation((...args: unknown[]) =>
        nativeListen(0, '127.0.0.1', args[2] as () => void),
      )
    const createServer = vi.spyOn(http, 'createServer').mockReturnValue(server)
    const open = vi
      .spyOn(browser, 'default')
      .mockImplementation(async (authorization) => {
        const address = server.address()
        if (!address || typeof address === 'string')
          throw new Error('Expected a TCP listener')
        const url = new URL(authorization)
        assert.equal(url.searchParams.get('prompt'), 'consent')
        assert.equal(url.searchParams.get('sub_type'), 'organization')
        const callback = new URL(
          `http://127.0.0.1:${address.port}/oauth/callback`,
        )
        callback.searchParams.set('state', url.searchParams.get('state')!)
        callback.searchParams.set(
          authorized ? 'code' : 'error',
          authorized ? 'test-code' : 'access_denied',
        )
        browserDone = new Promise<void>((resolve, reject) => {
          http
            .get(callback, (response) => {
              callbackResponse = {
                status: response.statusCode,
                type: response.headers['content-type'],
                body: '',
              }
              response.on('data', (chunk) => {
                callbackResponse!.body += chunk
              })
              response.on('end', resolve)
              response.on('error', reject)
            })
            .on('error', reject)
        })
        await browserDone
        return new ChildProcess()
      })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ access_token: 'test-token', expires_in: 60 }),
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const result = await Effect.runPromise(
        Effect.result(
          browserLogin({
            apiUrl: 'http://void',
            webUrl: 'http://void-web',
            clientId: 'client',
          }),
        ),
      )
      assert.equal(result._tag, authorized ? 'Success' : 'Failure')
      assert.equal(server.listening, false)
      await browserDone
      assert.equal(callbackResponse?.status, 200)
      assert.equal(callbackResponse?.type, 'text/html; charset=utf-8')
      assert.ok(
        callbackResponse?.body.includes(
          authorized ? 'You are signed in' : 'Sign-in canceled',
        ),
      )
    } finally {
      server.closeAllConnections()
      server.close()
      open.mockRestore()
      createServer.mockRestore()
      listen.mockRestore()
    }
  },
)
