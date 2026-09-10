import { beforeEach, expect, vi, test } from 'vitest'
import { ChildProcess } from 'node:child_process'
import * as http from 'node:http'
import { Console, Effect, Layer, Redacted } from 'effect'
import * as browser from 'open'
import {
  callbackUrl,
  exchange,
  layer,
  listenOnFreePort,
  OAuth,
  PREFERRED_CALLBACK_PORT,
  validateCallback,
} from '@/services/oauth'
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

const respond = (
  handler: (request: Request) => Response | Promise<Response>,
) => {
  api.routes[`POST ${tokenUrls.sandbox}`] = handler
  api.routes[`POST ${tokenUrls.production}`] = handler
}

const portOf = (server: http.Server) => {
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Expected a TCP listener')
  return address.port
}

const occupyPort = () =>
  new Promise<http.Server>((resolve) => {
    const blocker = http.createServer()
    blocker.listen(0, '127.0.0.1', () => resolve(blocker))
  })

const closeServer = (server: http.Server) =>
  new Promise<void>((resolve) => {
    server.closeAllConnections()
    server.close(() => resolve())
  })

const listenError = (code: string, message: string) =>
  Object.assign(new Error(message), { code })

interface CallbackResponse {
  status: number | undefined
  type: string | undefined
  body: string
}

interface BrowserLoginOptions {
  authorized: boolean
  busyPreferredPort?: boolean
}

const loginThroughBrowser = async ({
  authorized,
  busyPreferredPort = false,
}: BrowserLoginOptions) => {
  let callbackResponse: CallbackResponse | undefined
  let browserDone: Promise<void> | undefined
  let callbackPort: number | undefined
  let authorizationRedirectUri: string | null | undefined
  let exchangeRedirectUri: string | null | undefined
  let listenAttempts = 0
  const server = http.createServer()
  const nativeListen = server.listen.bind(server)
  const listen = vi.spyOn(server, 'listen').mockImplementation(() => {
    listenAttempts++
    if (busyPreferredPort && listenAttempts === 1) {
      process.nextTick(() =>
        server.emit('error', listenError('EADDRINUSE', 'address in use')),
      )
      return server
    }
    return nativeListen(0, '127.0.0.1')
  })
  const createServer = vi.spyOn(http, 'createServer').mockReturnValue(server)
  const open = vi
    .spyOn(browser, 'default')
    .mockImplementation(async (authorization) => {
      callbackPort = portOf(server)
      const url = new URL(authorization)
      authorizationRedirectUri = url.searchParams.get('redirect_uri')
      const callback = new URL(
        `http://127.0.0.1:${callbackPort}/oauth/callback`,
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
  respond(async (request) => {
    exchangeRedirectUri = new URLSearchParams(await request.text()).get(
      'redirect_uri',
    )
    return Response.json({ access_token: 'test-token', expires_in: 60 })
  })
  const { lines, console } = captureConsole()
  try {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const oauth = yield* OAuth
        return yield* oauth.login('sandbox')
      }).pipe(
        Effect.provide(layer.pipe(Layer.provide(api.layer))),
        Effect.provideService(Console.Console, console),
        Effect.result,
      ),
    )
    await browserDone
    return {
      result,
      server,
      output: lines.join('\n'),
      callbackResponse,
      callbackPort,
      authorizationRedirectUri,
      exchangeRedirectUri,
      listenAttempts,
    }
  } finally {
    server.closeAllConnections()
    server.close()
    open.mockRestore()
    createServer.mockRestore()
    listen.mockRestore()
  }
}

beforeEach(() => {
  api = fakeHttp()
})

test.each([true, false])(
  'closes the callback server after OAuth completion (authorized: %s)',
  async (authorized) => {
    const login = await loginThroughBrowser({ authorized })
    expect(login.result._tag).toBe(authorized ? 'Success' : 'Failure')
    expect(login.server.listening).toBe(false)
    expect(login.callbackResponse).toMatchObject({
      status: 200,
      type: 'text/html; charset=utf-8',
    })
    expect(login.callbackResponse!.body).toContain(
      authorized ? 'You are signed in' : 'Sign-in canceled',
    )
  },
)

test('authorization and token requests use the port the callback server bound', async () => {
  const login = await loginThroughBrowser({ authorized: true })
  expect(login.result._tag).toBe('Success')
  expect(login.listenAttempts).toBe(1)
  expect(login.authorizationRedirectUri).toBe(callbackUrl(login.callbackPort!))
  expect(login.exchangeRedirectUri).toBe(callbackUrl(login.callbackPort!))
  expect(login.output).not.toContain('is busy')
})

test('falls back to a free port when the preferred one is busy', async () => {
  const login = await loginThroughBrowser({
    authorized: true,
    busyPreferredPort: true,
  })
  expect(login.result._tag).toBe('Success')
  expect(login.listenAttempts).toBe(2)
  expect(login.authorizationRedirectUri).toBe(callbackUrl(login.callbackPort!))
  expect(login.exchangeRedirectUri).toBe(callbackUrl(login.callbackPort!))
  expect(login.output).toContain(
    `Port ${PREFERRED_CALLBACK_PORT} is busy, using port ${login.callbackPort}`,
  )
})

test('listenOnFreePort binds the preferred port when it is free', async () => {
  const probe = await occupyPort()
  const port = portOf(probe)
  await closeServer(probe)
  const server = http.createServer()
  try {
    expect(await Effect.runPromise(listenOnFreePort(server, port))).toEqual({
      port,
      fallback: false,
    })
    expect(portOf(server)).toBe(port)
  } finally {
    await closeServer(server)
  }
})

test('listenOnFreePort picks another port when the preferred one is taken', async () => {
  const blocker = await occupyPort()
  const server = http.createServer()
  try {
    const listener = await Effect.runPromise(
      listenOnFreePort(server, portOf(blocker)),
    )
    expect(listener.fallback).toBe(true)
    expect(listener.port).not.toBe(portOf(blocker))
    expect(portOf(server)).toBe(listener.port)
  } finally {
    await closeServer(server)
    await closeServer(blocker)
  }
})

test.each([
  ['EADDRINUSE', 'address in use', 'Cannot start the sign-in callback server'],
  ['EACCES', 'permission denied', 'permission denied'],
])(
  'listenOnFreePort fails when binding keeps failing (%s)',
  async (code, message, expected) => {
    const server = http.createServer()
    vi.spyOn(server, 'listen').mockImplementation(() => {
      process.nextTick(() => server.emit('error', listenError(code, message)))
      return server
    })
    await expect(
      Effect.runPromise(listenOnFreePort(server, PREFERRED_CALLBACK_PORT)),
    ).rejects.toThrow(expected)
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
