import { afterEach, describe, expect, vi, test } from 'vitest'
import { Effect, Fiber } from 'effect'
import { AuthError } from '../schemas/Auth'
import {
  type CreateEventSource,
  type ListenEventSource,
  startListening,
} from './listen'

/**
 * Fake {@link ListenEventSource} that records every instance created and lets a
 * test drive the stream by pushing raw message payloads into `onmessage`.
 */
class FakeEventSource implements ListenEventSource {
  static instances: FakeEventSource[] = []

  url: string
  init: { fetch: typeof fetch }
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror:
    | ((event: {
        code?: number | undefined
        message?: string | undefined
      }) => void)
    | null = null
  closed = false

  constructor(url: string, init: { fetch: typeof fetch }) {
    this.url = url
    this.init = init
    FakeEventSource.instances.push(this)
  }

  close() {
    this.closed = true
  }

  /** Simulate the server pushing a message frame. */
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

/** Returns the event source at `index`, asserting it exists. */
const instanceAt = (index: number): FakeEventSource => {
  const instance = FakeEventSource.instances[index]
  if (!instance) {
    throw new Error(`No event source created at index ${index}`)
  }
  return instance
}

const createFakeEventSource: CreateEventSource = (url, init) =>
  new FakeEventSource(url, init as { fetch: typeof fetch })

const okResponse = () =>
  Promise.resolve({ status: 200, statusText: 'OK' } as Response)

const baseOptions = (
  overrides: Partial<Parameters<typeof startListening>[0]>,
) => ({
  listenUrl: 'https://api.polar.sh/v1/cli/listen/org_123',
  forwardUrl: 'http://localhost:3000/webhook',
  organizationName: 'Acme',
  accessToken: 'test-token',
  createEventSource: createFakeEventSource,
  forward: vi.fn(okResponse) as unknown as typeof fetch,
  ...overrides,
})

const fibers: Fiber.Fiber<void, unknown>[] = []

/** Start the stream in the background and return the latest fake event source. */
const run = (overrides: Partial<Parameters<typeof startListening>[0]> = {}) => {
  const options = baseOptions(overrides)
  const fiber = Effect.runFork(startListening(options))
  fibers.push(fiber)
  return { options, fiber }
}

afterEach(async () => {
  await Promise.all(
    fibers.map((fiber) => Effect.runPromise(Fiber.interrupt(fiber))),
  )
  fibers.length = 0
  FakeEventSource.instances = []
})

describe('startListening', () => {
  test.each([401, 500])(
    'preserves stream error code %i as a typed ListenError',
    async (code) => {
      const { fiber } = run()
      const source = instanceAt(0)
      const cause = { code, message: 'Stream failed (request 401)' }
      source.onerror?.(cause)

      const error = await Effect.runPromise(Fiber.join(fiber).pipe(Effect.flip))
      expect(error).toMatchObject({
        _tag: 'ListenError',
        code,
        message: cause.message,
        cause,
      })
      expect(source.closed).toBe(true)
    },
  )

  test('keeps the stream open for errors without a code', () => {
    run()
    const source = instanceAt(0)
    source.onerror?.({ message: 'Transient connection error' })
    expect(source.closed).toBe(false)
  })

  test('propagates transport failures to EventSource without closing the listener', async () => {
    const transportError = new TypeError('Connection reset')
    run({ streamFetch: () => Promise.reject(transportError) })
    const source = instanceAt(0)
    await expect(source.init.fetch(source.url)).rejects.toBe(transportError)
    source.onerror?.({ message: 'Transient connection error' })
    expect(source.closed).toBe(false)
  })

  test('terminates on typed credential resolution failures', async () => {
    const { fiber } = run({
      streamFetch: () =>
        Effect.runPromise(
          Effect.fail(new AuthError({ message: 'Keyring unavailable' })),
        ),
    })
    const source = instanceAt(0)
    expect((await source.init.fetch(source.url)).status).toBe(401)
    const error = await Effect.runPromise(Fiber.join(fiber).pipe(Effect.flip))
    expect(error).toMatchObject({ _tag: 'ListenError', code: 0 })
    expect(source.closed).toBe(true)
  })

  test('opens a single event source for the listen url', () => {
    run()

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(instanceAt(0).url).toBe('https://api.polar.sh/v1/cli/listen/org_123')
  })

  test('authenticates the stream with a bearer token while preserving headers', async () => {
    const forward = vi.fn(okResponse) as unknown as typeof fetch
    run({ forward })

    const eventSource = instanceAt(0)
    await eventSource.init.fetch('https://api.polar.sh/v1/cli/listen/org_123', {
      headers: { Accept: 'text/event-stream' },
    } as RequestInit)

    expect(forward).toHaveBeenCalledTimes(1)
    expect(forward).toHaveBeenCalledWith(
      'https://api.polar.sh/v1/cli/listen/org_123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          Authorization: 'Bearer test-token',
        }),
      }),
    )
  })

  test('forwards decoded webhook events to the local url', async () => {
    const forward = vi.fn(okResponse) as unknown as typeof fetch
    run({ forward })

    // The server sends `payload.payload` as the exact raw JSON string it
    // signed, not a parsed object. The client must forward it byte-for-byte.
    const rawPayload = JSON.stringify({
      type: 'order.created',
      timestamp: '2026-01-01T00:00:00Z',
      data: {},
    })

    instanceAt(0).emit({
      id: 'evt_1',
      key: 'webhook',
      payload: { webhook_event_id: 'whid_1', payload: rawPayload },
      headers: {
        'user-agent': 'polar.sh webhooks',
        'content-type': 'application/json',
        'webhook-id': 'wh_1',
        'webhook-timestamp': '12345',
        'webhook-signature': 'sig',
      },
    })

    expect(forward).toHaveBeenCalledWith(
      'http://localhost:3000/webhook',
      expect.objectContaining({
        method: 'POST',
        body: rawPayload,
      }),
    )
  })

  test('reconnects when the server sends a reconnect event', () => {
    run()

    expect(FakeEventSource.instances).toHaveLength(1)
    const first = instanceAt(0)

    first.emit({ type: 'reconnect' })

    // The original connection is torn down and a brand new one is opened.
    expect(first.closed).toBe(true)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(instanceAt(1).url).toBe(first.url)
    expect(instanceAt(1).closed).toBe(false)
  })

  test('does not reconnect on the connected acknowledgement', () => {
    run()

    const first = instanceAt(0)
    first.emit({
      key: 'connected',
      ts: '2026-01-01T00:00:00Z',
      secret: 'whsec_test',
    })

    expect(first.closed).toBe(false)
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  test('only prints the connection banner for the first connection', () => {
    const logged: string[] = []
    const log = console.log
    console.log = (...args: unknown[]) => {
      logged.push(args.join(' '))
    }

    try {
      run()

      const ack = {
        key: 'connected',
        ts: '2026-01-01T00:00:00Z',
        secret: 'whsec_test',
      }

      // First connection acknowledges and prints the banner.
      instanceAt(0).emit(ack)
      const firstBannerCount = logged.filter((line) =>
        line.includes('Connected'),
      ).length
      expect(firstBannerCount).toBe(1)

      // Server asks us to reconnect; the fresh connection acknowledges again.
      instanceAt(0).emit({ type: 'reconnect' })
      instanceAt(1).emit(ack)

      // The banner is not repeated for the reconnected stream.
      const totalBannerCount = logged.filter((line) =>
        line.includes('Connected'),
      ).length
      expect(totalBannerCount).toBe(1)
    } finally {
      console.log = log
    }
  })
})
