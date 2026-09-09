import { afterAll, afterEach, expect, vi, test } from 'vitest'
import { ChildProcess } from 'node:child_process'
import * as http from 'node:http'
import { Effect, Redacted } from 'effect'
import * as browser from 'open'
import type { Session } from '../schemas/Auth'
import { exchange, layer, OAuth, validateCallback } from './oauth'

vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>()
  return { ...actual, createServer: vi.fn(actual.createServer) }
})
vi.mock('open', () => ({ default: vi.fn() }))

const fetchMock = vi.spyOn(globalThis, 'fetch')
afterEach(() => fetchMock.mockReset())
afterAll(() => fetchMock.mockRestore())

test.each([true, false])(
  'closes the callback server after OAuth completion (authorized: %s)',
  async (authorized) => {
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
        const callback = new URL(
          `http://127.0.0.1:${address.port}/oauth/callback`,
        )
        callback.searchParams.set('state', url.searchParams.get('state')!)
        callback.searchParams.set(
          authorized ? 'code' : 'error',
          authorized ? 'test-code' : 'access_denied',
        )
        await new Promise<void>((resolve, reject) => {
          http
            .get(callback, (response) => {
              response.resume()
              response.on('end', resolve)
              response.on('error', reject)
            })
            .on('error', reject)
        })
        return new ChildProcess()
      })
    fetchMock.mockResolvedValue(
      Response.json({ access_token: 'test-token', expires_in: 60 }),
    )
    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const oauth = yield* OAuth
          return yield* oauth.login('sandbox')
        }).pipe(Effect.provide(layer), Effect.result),
      )
      expect(result._tag).toBe(authorized ? 'Success' : 'Failure')
      expect(server.listening).toBe(false)
    } finally {
      server.closeAllConnections()
      server.close()
      open.mockRestore()
      createServer.mockRestore()
      listen.mockRestore()
    }
  },
)

const session: Session = {
  version: 1,
  accessToken: Redacted.make('old'),
  refreshToken: Redacted.make('refresh'),
  expiresAt: 0,
  scopes: ['organizations:read'],
}

test('exchange converts seconds to milliseconds and preserves omitted refresh token/scopes', async () => {
  fetchMock.mockResolvedValue(
    Response.json({ access_token: 'new', expires_in: 3600 }),
  )
  const before = Date.now()
  const updated = await Effect.runPromise(
    exchange(
      'sandbox',
      new URLSearchParams({ grant_type: 'refresh_token' }),
      session,
    ),
  )
  expect(updated.expiresAt).toBeGreaterThanOrEqual(before + 3600_000)
  expect(updated.expiresAt).toBeLessThanOrEqual(Date.now() + 3600_000)
  expect(Redacted.value(updated.refreshToken!)).toBe('refresh')
  expect(updated.scopes).toEqual(session.scopes)
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
    'https://sandbox-api.polar.sh/v1/oauth2/token',
  )
})

test('exchange retains rotated credentials and selects production explicitly', async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      access_token: 'new',
      refresh_token: 'rotated',
      expires_in: 60,
      scope: 'organizations:read webhooks:read',
    }),
  )
  const updated = await Effect.runPromise(
    exchange('production', new URLSearchParams(), session),
  )
  expect(Redacted.value(updated.refreshToken!)).toBe('rotated')
  expect(updated.scopes).toEqual(['organizations:read', 'webhooks:read'])
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
    'https://api.polar.sh/v1/oauth2/token',
  )
})

test.each([400, 401, 500])(
  'OAuth HTTP %s errors never include response secrets',
  async (status) => {
    fetchMock.mockResolvedValue(new Response('secret-token', { status }))
    const result = await Effect.runPromise(
      exchange('sandbox', new URLSearchParams()).pipe(Effect.result),
    )
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure.message).not.toContain('secret-token')
      expect(result.failure.message).toContain(
        status === 500 ? 'unavailable' : 'rejected',
      )
    }
  },
)

test('network errors and malformed token responses are sanitized', async () => {
  fetchMock.mockRejectedValue(new Error('secret-in-network-error'))
  await expect(
    Effect.runPromise(exchange('sandbox', new URLSearchParams())),
  ).rejects.toThrow('network request failed')
  fetchMock.mockResolvedValue(
    Response.json({ access_token: 'secret-token', expires_in: -1 }),
  )
  const result = await Effect.runPromise(
    exchange('sandbox', new URLSearchParams()).pipe(Effect.result),
  )
  expect(JSON.stringify(result)).not.toContain('secret-token')
  expect(result._tag).toBe('Failure')
})

test('callback verifies state before accepting codes or OAuth denial', async () => {
  const base = 'http://127.0.0.1:3333/oauth/callback'
  expect(
    await Effect.runPromise(
      validateCallback(new URL(`${base}?state=expected&code=code`), 'expected'),
    ),
  ).toBe('code')
  await expect(
    Effect.runPromise(
      validateCallback(new URL(`${base}?state=wrong&code=code`), 'expected'),
    ),
  ).rejects.toThrow('state')
  await expect(
    Effect.runPromise(
      validateCallback(
        new URL(`${base}?state=expected&error=access_denied`),
        'expected',
      ),
    ),
  ).rejects.toThrow('denied')
  await expect(
    Effect.runPromise(
      validateCallback(new URL(`${base}?state=expected`), 'expected'),
    ),
  ).rejects.toThrow('missing')
})
