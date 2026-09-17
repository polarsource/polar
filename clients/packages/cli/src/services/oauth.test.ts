import { beforeEach, expect, vi, test } from 'vitest'
import { ChildProcess } from 'node:child_process'
import * as http from 'node:http'
import { Console, Effect, Layer, Redacted } from 'effect'
import * as browser from 'open'
import { exchange, layer, OAuth, validateCallback } from '@/services/oauth'
import { captureConsole } from '@/utils/test-utils/cli'
import { fakeHttp } from '@/utils/test-utils/http'
import { session } from '@/utils/test-utils/services'

vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>()
  return { ...actual, createServer: vi.fn(actual.createServer) }
})
vi.mock('open', () => ({ default: vi.fn() }))

const tokenUrls = {
  sandbox: 'https://sandbox-api.polar.sh/v1/oauth2/token',
  production: 'https://api.polar.sh/v1/oauth2/token',
}

let api: ReturnType<typeof fakeHttp>

const respond = (handler: () => Response) => {
  api.routes[`POST ${tokenUrls.sandbox}`] = handler
  api.routes[`POST ${tokenUrls.production}`] = handler
}

beforeEach(() => {
  api = fakeHttp()
})

test.each([true, false])(
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
    respond(() => Response.json({ access_token: 'test-token', expires_in: 60 }))
    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const oauth = yield* OAuth
          return yield* oauth.login('sandbox')
        }).pipe(
          Effect.provide(layer.pipe(Layer.provide(api.layer))),
          Effect.provideService(Console.Console, captureConsole().console),
          Effect.result,
        ),
      )
      expect(result._tag).toBe(authorized ? 'Success' : 'Failure')
      expect(server.listening).toBe(false)
      await browserDone
      expect(callbackResponse).toMatchObject({
        status: 200,
        type: 'text/html; charset=utf-8',
      })
      expect(callbackResponse!.body).toContain(
        authorized ? 'You are signed in' : 'Sign-in canceled',
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

const previous = session('old', { expiresAt: 0 })

const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromise(effect)

test('exchange converts seconds to milliseconds and preserves omitted refresh token/scopes', async () => {
  respond(() => Response.json({ access_token: 'new', expires_in: 3600 }))
  const before = Date.now()
  const updated = await run(
    exchange(
      'sandbox',
      new URLSearchParams({ grant_type: 'refresh_token' }),
      previous,
    ).pipe(Effect.provide(api.layer)),
  )
  expect(updated.expiresAt).toBeGreaterThanOrEqual(before + 3600_000)
  expect(updated.expiresAt).toBeLessThanOrEqual(Date.now() + 3600_000)
  expect(Redacted.value(updated.refreshToken!)).toBe('refresh')
  expect(updated.scopes).toEqual(previous.scopes)
  expect(api.urls()).toEqual([tokenUrls.sandbox])
})

test('exchange retains rotated credentials and selects production explicitly', async () => {
  respond(() =>
    Response.json({
      access_token: 'new',
      refresh_token: 'rotated',
      expires_in: 60,
      scope: 'organizations:read webhooks:read',
    }),
  )
  const updated = await run(
    exchange('production', new URLSearchParams(), previous).pipe(
      Effect.provide(api.layer),
    ),
  )
  expect(Redacted.value(updated.refreshToken!)).toBe('rotated')
  expect(updated.scopes).toEqual(['organizations:read', 'webhooks:read'])
  expect(api.urls()).toEqual([tokenUrls.production])
})

test.each([400, 401, 500])(
  'OAuth HTTP %s errors never include response secrets',
  async (status) => {
    respond(() => new Response('secret-token', { status }))
    const result = await run(
      exchange('sandbox', new URLSearchParams()).pipe(
        Effect.provide(api.layer),
        Effect.result,
      ),
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
  respond(() => {
    throw new Error('secret-in-network-error')
  })
  await expect(
    run(
      exchange('sandbox', new URLSearchParams()).pipe(
        Effect.provide(api.layer),
      ),
    ),
  ).rejects.toThrow('network request failed')
  respond(() => Response.json({ access_token: 'secret-token', expires_in: -1 }))
  const result = await run(
    exchange('sandbox', new URLSearchParams()).pipe(
      Effect.provide(api.layer),
      Effect.result,
    ),
  )
  expect(JSON.stringify(result)).not.toContain('secret-token')
  expect(result._tag).toBe('Failure')
})

test('callback verifies state before accepting codes or OAuth denial', async () => {
  const base = 'http://127.0.0.1:3333/oauth/callback'
  expect(
    await run(
      validateCallback(new URL(`${base}?state=expected&code=code`), 'expected'),
    ),
  ).toBe('code')
  await expect(
    run(validateCallback(new URL(`${base}?state=wrong&code=code`), 'expected')),
  ).rejects.toThrow('state')
  await expect(
    run(
      validateCallback(
        new URL(`${base}?state=expected&error=access_denied`),
        'expected',
      ),
    ),
  ).rejects.toThrow('denied')
  await expect(
    run(validateCallback(new URL(`${base}?state=expected`), 'expected')),
  ).rejects.toThrow('missing')
})
