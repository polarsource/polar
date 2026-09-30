import { afterEach, describe, expect, vi, test } from 'vitest'
import { Effect, Fiber, Option } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { AuthError } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { Deliveries, type Delivery } from '@/services/deliveries'
import { type ListenEvent, startListening } from '@/services/listen'
import { fakeAuth, overrideCredential } from '@/utils/test-utils/services'

const fakeDeliveries = () => {
  const state = {
    recorded: [] as Array<{ eventId: string; delivery: Delivery }>,
  }
  const deliveries = Deliveries.of({
    record: (eventId, delivery) =>
      Effect.sync(() => {
        state.recorded.push({ eventId, delivery })
      }),
    await: () => Effect.succeed(Option.none()),
  })
  return { deliveries, state }
}

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
  let deliveries: ReturnType<typeof fakeDeliveries>
  const run = (
    fetch: Fetch = streamFetch,
    credentials = auth,
    forwardUrl = 'http://localhost:3000/webhook',
  ) => {
    events = []
    deliveries = fakeDeliveries()
    const fiber = Effect.runFork(
      startListening({
        organization: {
          id: 'org_1',
          name: 'Acme',
          slug: 'acme',
          environment: 'sandbox',
        },
        forwardUrl,
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
        Effect.provideService(Deliveries, deliveries.deliveries),
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
  const emitWebhook = (headers: Record<string, string>) =>
    emit({
      id: 'evt_1',
      key: 'webhook',
      payload: {
        webhook_event_id: 'whid_1',
        payload: '{ "type": "order.paid" }',
      },
      headers,
    })

  afterEach(async () => {
    await Promise.all(
      fibers.map((fiber) => Effect.runPromise(Fiber.interrupt(fiber))),
    )
    fibers.length = 0
    connections.length = 0
    requests.length = 0
    forward.mockClear()
    vi.restoreAllMocks()
    vi.useRealTimers()
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
    expect(requests[0]!.get('Polar-Organization')).toBe('org_1')
    await Effect.runPromise(Fiber.interrupt(fiber))
    expect(connections[0]!.signal?.aborted).toBe(true)
  })

  test('does not follow redirects, like real webhook delivery', async () => {
    run()
    await tick()
    emitWebhook({})
    await tick()
    expect(forward).toHaveBeenCalledWith(
      'http://localhost:3000/webhook',
      expect.objectContaining({ redirect: 'manual' }),
    )
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

  test('records the outcome of a triggered event for polar trigger', async () => {
    run()
    await tick()
    emitWebhook({ 'x-polar-triggered': 'true' })
    await tick()
    expect(deliveries.state.recorded).toEqual([
      {
        eventId: 'whid_1',
        delivery: expect.objectContaining({
          forwardUrl: 'http://localhost:3000/webhook',
          status: 200,
        }),
      },
    ])
  })

  test('records the response body when your server rejects a triggered event', async () => {
    forward.mockResolvedValueOnce(
      new Response('Missing customer', {
        status: 422,
        statusText: 'Unprocessable Entity',
      }),
    )
    run()
    await tick()
    emitWebhook({ 'x-polar-triggered': 'true' })
    await tick()
    expect(deliveries.state.recorded[0]?.delivery).toEqual(
      expect.objectContaining({ status: 422, body: 'Missing customer' }),
    )
  })

  test('records what arrived when a rejected response body stalls, then moves on', async () => {
    forward.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('partial'))
          },
        }),
        { status: 500 },
      ),
    )
    run()
    await tick()
    emitWebhook({ 'x-polar-triggered': 'true' })
    emitWebhook({ 'x-polar-triggered': 'true' })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(deliveries.state.recorded.map(({ delivery }) => delivery)).toEqual([
      expect.objectContaining({ status: 500, body: 'partial' }),
      expect.objectContaining({ status: 200 }),
    ])
  })

  test('gives up on a server that does not respond, like real webhook delivery', async () => {
    vi.useFakeTimers()
    let hung: AbortSignal | null | undefined
    forward.mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          hung = init?.signal
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          )
        }),
    )
    run()
    await vi.advanceTimersByTimeAsync(20)
    emitWebhook({ 'x-polar-triggered': 'true' })
    emitWebhook({ 'x-polar-triggered': 'true' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(deliveries.state.recorded.map(({ delivery }) => delivery)).toEqual([
      expect.objectContaining({ failure: 'no response after 10 seconds' }),
      expect.objectContaining({ status: 200 }),
    ])
    expect(events).toContainEqual(
      expect.objectContaining({
        _tag: 'ForwardFailed',
        reason: 'no response after 10 seconds',
      }),
    )
    expect(hung?.aborted).toBe(true)
  })

  test('stops reading a rejected response body at the limit', async () => {
    const cancel = vi.fn()
    forward.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(new TextEncoder().encode('x'.repeat(500)))
          },
          cancel,
        }),
        { status: 500 },
      ),
    )
    run()
    await tick()
    emitWebhook({ 'x-polar-triggered': 'true' })
    await tick()
    expect(deliveries.state.recorded[0]?.delivery.body).toBe(
      `${'x'.repeat(2000)}…`,
    )
    expect(cancel).toHaveBeenCalled()
  })

  test('keeps secrets in the forward URL out of the record', async () => {
    const forwardUrl = 'http://user:s3cret@localhost:3000/webhook?token=t0ken'
    run(streamFetch, auth, forwardUrl)
    await tick()
    emitWebhook({ 'x-polar-triggered': 'true' })
    await tick()
    expect(deliveries.state.recorded[0]?.delivery.forwardUrl).toBe(
      'http://***@localhost:3000/webhook?token=***',
    )
    expect(forward).toHaveBeenCalledWith(forwardUrl, expect.anything())
  })

  test('does not record real events', async () => {
    run()
    await tick()
    emitWebhook({})
    await tick()
    expect(forward).toHaveBeenCalled()
    expect(deliveries.state.recorded).toEqual([])
  })

  test('explains and records a host that cannot be found', async () => {
    forward.mockRejectedValueOnce(
      Object.assign(new Error('getaddrinfo ENOTFOUND qweqe'), {
        code: 'ENOTFOUND',
      }),
    )
    run()
    await tick()
    emitWebhook({ 'x-polar-triggered': 'true' })
    await tick()
    expect(events).toContainEqual(
      expect.objectContaining({
        _tag: 'ForwardFailed',
        reason: 'host not found, check the forward URL',
      }),
    )
    expect(deliveries.state.recorded[0]?.delivery).toMatchObject({
      failure: 'host not found, check the forward URL',
    })
  })

  test('hints that the server is down when Bun refuses the connection', async () => {
    forward.mockRejectedValueOnce(
      Object.assign(
        new TypeError(
          'Unable to connect. Is the computer able to access the url?',
        ),
        { code: 'ConnectionRefused' },
      ),
    )
    run()
    await tick()
    emitWebhook({})
    await tick()
    expect(events).toContainEqual(
      expect.objectContaining({
        _tag: 'ForwardFailed',
        reason: 'connection refused, is your server running?',
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
