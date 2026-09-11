import { afterEach, describe, expect, vi, test } from 'vitest'
import { Console, Effect, Fiber } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { startListening } from '@/commands/listen'
import { Auth } from '@/services/auth'
import { fakeAuth, overrideCredential } from '@/utils/test-utils/services'

const noop = () => {}

const captureConsole = () => {
  const lines: string[] = []
  const console: Console.Console = {
    assert: noop,
    clear: noop,
    count: noop,
    countReset: noop,
    debug: noop,
    dir: noop,
    dirxml: noop,
    error: noop,
    group: noop,
    groupCollapsed: noop,
    groupEnd: noop,
    info: noop,
    log: (...args) => {
      lines.push(args.map(String).join(' '))
    },
    table: noop,
    time: noop,
    timeEnd: noop,
    timeLog: noop,
    trace: noop,
    warn: noop,
  }
  return { lines, console }
}

describe('non-webhook eventstream events', () => {
  const { auth } = fakeAuth({ credential: overrideCredential('test-token') })
  const fibers: Fiber.Fiber<never, unknown>[] = []
  const connections: {
    controller: ReadableStreamDefaultController<Uint8Array>
    signal: AbortSignal | null | undefined
  }[] = []
  type Fetch = (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => Promise<Response>
  const streamFetch: Fetch = async (_input, init) => {
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
    const captured = captureConsole()
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
        Effect.provideService(Console.Console, captured.console),
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
    forward.mockClear()
    vi.restoreAllMocks()
  })

  test('silently skips non-webhook eventstream events without forwarding or erroring', async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    run()
    await tick()
    emit({ key: 'connected', ts: '2026-01-01T00:00:00Z', secret: 'whsec_test' })
    await tick()
    emit({
      id: 'evt_1',
      key: 'order.receipt_generated',
      payload: { order_id: 'o_1' },
    })
    await tick()
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('')
    expect(stderrOutput).not.toContain('could not decode')
    expect(stderrOutput).not.toContain('order.receipt_generated')
    expect(stderrOutput).not.toContain('polar update')
    expect(forward).not.toHaveBeenCalled()
  })

  test('still errors on a malformed webhook.created event', async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    run()
    await tick()
    emit({ key: 'connected', ts: '2026-01-01T00:00:00Z', secret: 'whsec_test' })
    await tick()
    emit({
      id: 'evt_1',
      key: 'webhook.created',
      payload: { webhook_event_id: 'whid_1' },
    })
    await tick()
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('')
    expect(stderrOutput).toContain('could not decode')
    expect(stderrOutput).toContain('webhook.created')
    expect(stderrOutput).toContain('polar update')
    expect(forward).not.toHaveBeenCalled()
  })
})
