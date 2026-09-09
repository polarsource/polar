import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest'
import { Effect, Fiber, Redacted } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { AuthError, type PolarEnvironment } from '../schemas/Auth'
import { Auth } from '../services/auth'
import { authenticatedStreamClient, startListening } from './listen'

describe('startListening', () => {
  const auth = Auth.of({
    override: Effect.succeed(false),
    resolve: () =>
      Effect.succeed({
        accessToken: Redacted.make('test-token'),
        source: 'override' as const,
      }),
    login: () => Effect.die('unused'),
    logout: () => Effect.die('unused'),
    select: () => Effect.die('unused'),
  })
  const fibers: Fiber.Fiber<never, unknown>[] = []
  const connections: {
    controller: ReadableStreamDefaultController<Uint8Array>
    signal: AbortSignal | null | undefined
  }[] = []
  const requests: Headers[] = []
  type Fetch = (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => Promise<Response>
  const streamFetch: Fetch = async (_input, init) => {
    requests.push(new Headers(init?.headers))
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          connections.push({ controller, signal: init?.signal })
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    )
  }
  const forward = vi.fn<Fetch>(async () => new Response(null, { status: 200 }))
  const run = (fetch: Fetch = streamFetch, credentials = auth) => {
    const fiber = Effect.runFork(
      startListening({
        listenUrl: 'https://example.test/listen',
        forwardUrl: 'http://localhost:3000/webhook',
        organizationName: 'Acme',
        environment: 'sandbox',
        forward,
      }).pipe(
        Effect.provide(FetchHttpClient.layer),
        Effect.provideService(
          FetchHttpClient.Fetch,
          fetch as typeof globalThis.fetch,
        ),
        Effect.provideService(Auth, credentials),
      ),
    )
    fibers.push(fiber)
    return fiber
  }
  const tick = () => new Promise((resolve) => setTimeout(resolve, 20))
  const emit = (data: unknown, index = 0, prefix = '') =>
    connections[index]!.controller.enqueue(
      new TextEncoder().encode(`${prefix}data: ${JSON.stringify(data)}\n\n`),
    )

  afterEach(async () => {
    await Promise.all(
      fibers.map((fiber) => Effect.runPromise(Fiber.interrupt(fiber))),
    )
    fibers.length = 0
    connections.length = 0
    requests.length = 0
    forward.mockClear()
    vi.restoreAllMocks()
  })

  test.each([401, 500])('preserves terminal HTTP status %i', async (status) => {
    const fiber = run(async () => new Response(null, { status }))
    expect(
      await Effect.runPromise(Fiber.join(fiber).pipe(Effect.flip)),
    ).toMatchObject({ _tag: 'ListenError', code: status })
  })

  test('terminates on credential resolution failures without issuing a request', async () => {
    const fiber = run(streamFetch, {
      ...auth,
      resolve: () =>
        Effect.fail(new AuthError({ message: 'Keyring unavailable' })),
    })
    expect(
      await Effect.runPromise(Fiber.join(fiber).pipe(Effect.flip)),
    ).toMatchObject({ _tag: 'ListenError', code: 0 })
    expect(requests).toHaveLength(0)
  })

  test('authenticates the SSE request and aborts on interruption', async () => {
    const fiber = run()
    await tick()
    expect(requests[0]!.get('Authorization')).toBe('Bearer test-token')
    expect(requests[0]!.get('Accept')).toBe('text/event-stream')
    await Effect.runPromise(Fiber.interrupt(fiber))
    expect(connections[0]!.signal?.aborted).toBe(true)
  })

  test('forwards the exact signed payload and headers', async () => {
    run()
    await tick()
    const rawPayload = '{ "type": "order.created", "data": {} }'
    const headers = {
      'user-agent': 'polar.sh webhooks',
      'content-type': 'application/json',
      'webhook-id': 'wh_1',
      'webhook-timestamp': '12345',
      'webhook-signature': 'sig',
    }
    emit({
      id: 'evt_1',
      key: 'webhook',
      payload: { webhook_event_id: 'whid_1', payload: rawPayload },
      headers,
    })
    await tick()
    expect(forward).toHaveBeenCalledWith(
      'http://localhost:3000/webhook',
      expect.objectContaining({ method: 'POST', body: rawPayload, headers }),
    )
  })

  test('reconnects immediately, resumes event IDs and prints the banner once', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    run()
    await tick()
    const ack = {
      key: 'connected',
      ts: '2026-01-01T00:00:00Z',
      secret: 'whsec_test',
    }
    emit(ack)
    emit({ type: 'reconnect' }, 0, 'id: evt_1\n')
    await tick()
    expect(connections).toHaveLength(2)
    expect(connections[0]!.signal?.aborted).toBe(true)
    expect(requests[1]!.get('Last-Event-ID')).toBe('evt_1')
    emit(ack, 1)
    await tick()
    expect(
      log.mock.calls.filter(([line]) => String(line).includes('Connected')),
    ).toHaveLength(1)
  })

  test('logs malformed JSON without terminating the stream', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    run()
    await tick()
    connections[0]!.controller.enqueue(
      new TextEncoder().encode('data: {invalid\n\n'),
    )
    emit({ type: 'reconnect' })
    await tick()
    expect(log).toHaveBeenCalledWith('>> Failed to decode event')
    expect(connections).toHaveLength(2)
  })

  test('honors SSE retry directives and reconnects after EOF', async () => {
    run()
    await tick()
    connections[0]!.controller.enqueue(new TextEncoder().encode('retry: 1\n\n'))
    await tick()
    expect(connections).toHaveLength(2)
    connections[1]!.controller.close()
    await tick()
    expect(connections).toHaveLength(3)
  })

  test('reconnects after a transport failure using the server retry delay', async () => {
    let attempts = 0
    run(async (input, init) => {
      attempts++
      if (attempts === 2) throw new TypeError('Connection reset')
      return streamFetch(input, init)
    })
    await tick()
    connections[0]!.controller.enqueue(new TextEncoder().encode('retry: 1\n\n'))
    await tick()
    expect(attempts).toBe(3)
    expect(connections).toHaveLength(2)
  })

  test('rejects a non-SSE response', async () => {
    const fiber = run(async () => new Response('not SSE'))
    expect(
      await Effect.runPromise(Fiber.join(fiber).pipe(Effect.flip)),
    ).toMatchObject({
      code: 200,
      message: 'Expected a text/event-stream response.',
    })
  })
})

describe('authenticatedStreamClient', () => {
  let token: string
  let source: 'keyring' | 'override'
  let requests: string[]
  let resolutions: PolarEnvironment[]
  let refreshes: number
  let failure: boolean
  let status: number
  const auth = Auth.of({
    override: Effect.succeed(false),
    resolve: (environment, rejected) =>
      Effect.gen(function* () {
        resolutions.push(environment)
        if (failure) return yield* new AuthError({ message: 'refresh failed' })
        if (rejected) {
          refreshes++
          token = 'rotated'
        }
        return { accessToken: Redacted.make(token), source }
      }),
    login: () => Effect.die('listen must not open the browser'),
    logout: () => Effect.die('unused'),
    select: () => Effect.die('unused'),
  })
  const forward: (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => Promise<Response> = async (_input, init) => {
    requests.push(new Headers(init?.headers).get('Authorization') ?? '')
    return new Response(null, { status })
  }

  const makeClient = (environment: PolarEnvironment) =>
    authenticatedStreamClient(environment).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.Fetch, forward as typeof fetch),
    )

  beforeEach(() => {
    token = 'initial'
    source = 'keyring'
    requests = []
    resolutions = []
    refreshes = 0
    failure = false
    status = 200
  })

  test('reconnections resolve current credentials in the same environment', async () => {
    const stream = await Effect.runPromise(
      makeClient('production').pipe(Effect.provideService(Auth, auth)),
    )
    await Effect.runPromise(Effect.scoped(stream.get('https://example.test')))
    token = 'new-token'
    await Effect.runPromise(Effect.scoped(stream.get('https://example.test')))
    expect(requests).toEqual(['Bearer initial', 'Bearer new-token'])
    expect(resolutions).toEqual(['production', 'production'])
  })

  test('401 refresh is bounded to one retry across the entire listener', async () => {
    status = 401
    const stream = await Effect.runPromise(
      makeClient('sandbox').pipe(Effect.provideService(Auth, auth)),
    )
    expect(
      (
        await Effect.runPromise(
          Effect.scoped(stream.get('https://example.test')),
        )
      ).status,
    ).toBe(401)
    expect(
      (
        await Effect.runPromise(
          Effect.scoped(stream.get('https://example.test')),
        )
      ).status,
    ).toBe(401)
    expect(requests).toEqual([
      'Bearer initial',
      'Bearer rotated',
      'Bearer rotated',
    ])
    expect(refreshes).toBe(1)
  })

  test('override rejection never refreshes or falls back to saved credentials', async () => {
    source = 'override'
    status = 401
    const stream = await Effect.runPromise(
      makeClient('sandbox').pipe(Effect.provideService(Auth, auth)),
    )
    expect(
      (
        await Effect.runPromise(
          Effect.scoped(stream.get('https://example.test')),
        )
      ).status,
    ).toBe(401)
    expect(requests).toEqual(['Bearer initial'])
    expect(refreshes).toBe(0)
  })

  test('resolution failures reject instead of making an unauthenticated request', async () => {
    failure = true
    const stream = await Effect.runPromise(
      makeClient('sandbox').pipe(Effect.provideService(Auth, auth)),
    )
    await expect(
      Effect.runPromise(Effect.scoped(stream.get('https://example.test'))),
    ).rejects.toThrow('refresh failed')
    expect(requests).toEqual([])
  })
})
