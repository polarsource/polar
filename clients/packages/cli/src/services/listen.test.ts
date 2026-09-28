import { afterEach, describe, expect, vi, test } from 'vitest'
import { Effect, Fiber } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { AuthError } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { type ListenEvent, startListening } from '@/services/listen'
import { fakeAuth, overrideCredential } from '@/utils/test-utils/services'

describe('startListening', () => {
  const { auth } = fakeAuth({ credential: overrideCredential('test-token') })
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
  let events: ListenEvent[]
  const run = (fetch: Fetch = streamFetch, credentials = auth) => {
    events = []
    const fiber = Effect.runFork(
      startListening({
        organization: {
          id: 'org_1',
          name: 'Acme',
          slug: 'acme',
          environment: 'sandbox',
        },
        forwardUrl: 'http://localhost:3000/webhook',
        forward,
        onEvent: (event) =>
          Effect.sync(() => {
            events.push(event)
          }),
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
    const fiber = run(
      streamFetch,
      fakeAuth({
        credential: overrideCredential('test-token'),
        failure: new AuthError({ message: 'Keyring unavailable' }),
      }).auth,
    )
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
      'x-polar-triggered': 'true',
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
    expect(events).toContainEqual(
      expect.objectContaining({
        _tag: 'Forwarded',
        eventType: 'order.created',
        status: 200,
      }),
    )
  })

  test('reconnects immediately, resumes event IDs and announces the connection once', async () => {
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
    expect(events).toEqual([{ _tag: 'Connected', secret: 'whsec_test' }])
  })

  test('reports a refused connection to the local server', async () => {
    forward.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED 127.0.0.1:3000'),
    )
    run()
    await tick()
    emit({
      id: 'evt_1',
      key: 'webhook',
      payload: {
        webhook_event_id: 'whid_1',
        payload: '{ "type": "order.paid" }',
      },
      headers: {},
    })
    await tick()
    expect(events).toContainEqual(
      expect.objectContaining({
        _tag: 'ForwardFailed',
        eventType: 'order.paid',
        reason: 'connection refused, is your server running?',
      }),
    )
  })

  test('reports malformed JSON without terminating the stream', async () => {
    run()
    await tick()
    connections[0]!.controller.enqueue(
      new TextEncoder().encode('data: {invalid\n\n'),
    )
    emit({ type: 'reconnect' })
    await tick()
    expect(events).toEqual([{ _tag: 'Undecodable', key: undefined }])
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
