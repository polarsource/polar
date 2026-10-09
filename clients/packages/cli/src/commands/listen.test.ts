import { afterEach, describe, expect, test, vi } from 'vitest'
import { Effect } from 'effect'
import { FetchHttpClient } from 'effect/http'
import {
  forwardTarget,
  listen,
  probeTarget,
  renderEvent,
} from '@/commands/listen'
import { Auth } from '@/services/auth'
import { Deliveries } from '@/services/deliveries'
import type { ListenEvent } from '@/services/listen'
import { Organizations } from '@/services/organizations'
import { runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

describe('renderEvent', () => {
  const render = (
    event: ListenEvent,
    forwardUrl = 'http://localhost:3000/webhook',
  ) => {
    const lines: string[] = []
    const errors: string[] = []
    const emit = {
      out: (human: string) =>
        Effect.sync(() => {
          lines.push(stripAnsi(human))
        }),
      err: (human: string) =>
        Effect.sync(() => {
          errors.push(stripAnsi(human))
        }),
    }
    Effect.runSync(renderEvent(emit, 'Acme', forwardUrl)(event))
    return { output: lines.join('\n'), errors: errors.join('') }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows the organization, forward URL and signing secret on connect', () => {
    const { output, errors } = render({
      _tag: 'Connected',
      secret: 'whsec_test',
    })
    expect(output).toContain('Connected  Acme')
    expect(output).toContain('http://localhost:3000/webhook')
    expect(output).toContain('whsec_test')
    expect(errors).toBe('')
  })

  test('keeps secrets in the forward URL out of the banner', () => {
    const { output } = render(
      { _tag: 'Connected', secret: 'whsec_test' },
      'http://user:s3cret@localhost:3000/webhook?token=t0ken',
    )
    expect(output).toContain('http://***@localhost:3000/webhook?token=***')
    expect(output).not.toMatch(/s3cret|t0ken/)
  })

  test('prints a forwarded event with its status and duration', () => {
    const { output } = render({
      _tag: 'Forwarded',
      eventType: 'order.created',
      status: 200,
      statusText: 'OK',
      durationMs: 12.4,
    })
    expect(output).toContain('order.created')
    expect(output).toContain('200 OK')
    expect(output).toContain('12ms')
  })

  test('reports a failed forward on stderr', () => {
    const { output, errors } = render({
      _tag: 'ForwardFailed',
      eventType: 'order.paid',
      reason: 'connection refused, is your server running?',
      durationMs: 3,
    })
    expect(errors).toContain('order.paid')
    expect(errors).toContain(
      'failed  connection refused, is your server running?',
    )
    expect(output).toBe('')
  })

  test('reports an undecodable event on stderr with its key', () => {
    expect(render({ _tag: 'Undecodable', key: 'mystery' }).errors).toContain(
      'Event key: mystery',
    )
    expect(render({ _tag: 'Undecodable', key: undefined }).errors).toContain(
      'Event key: unknown',
    )
  })
})

describe('forwardTarget', () => {
  test.each([
    ['3000', 'http://localhost:3000/'],
    ['3000/api/webhooks', 'http://localhost:3000/api/webhooks'],
    [':3000/api/webhooks', 'http://localhost:3000/api/webhooks'],
    ['localhost:3000/api/webhooks', 'http://localhost:3000/api/webhooks'],
    ['  3000  ', 'http://localhost:3000/'],
    ['http://127.0.0.1:8080/hooks', 'http://127.0.0.1:8080/hooks'],
    ['https://my-app.ngrok.dev/webhooks', 'https://my-app.ngrok.dev/webhooks'],
  ])('expands %j to %s', (input, expected) => {
    expect(forwardTarget(input)?.href).toBe(expected)
  })

  test.each(['ftp://localhost/hooks', '99999', 'not a url', ''])(
    'rejects %j',
    (input) => {
      expect(forwardTarget(input)).toBeUndefined()
    },
  )
})

describe('probeTarget', () => {
  test('sees a server that is listening', async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response('ok') })
    try {
      expect(
        await Effect.runPromise(
          probeTarget(new URL(`http://localhost:${server.port}/`)),
        ),
      ).toBe('answering')
    } finally {
      server.stop(true)
    }
  })

  test('sees a port nothing is listening on', async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response('ok') })
    const { port } = server
    server.stop(true)
    expect(
      await Effect.runPromise(
        probeTarget(new URL(`http://localhost:${port}/`)),
      ),
    ).toBe('refused')
  })

  test('sees a host that does not exist', async () => {
    expect(
      await Effect.runPromise(
        probeTarget(new URL('http://polar-cli-test.invalid/')),
      ),
    ).toBe('unknownHost')
  })
})

describe('listen command', () => {
  const acme = {
    id: '1a2b3c4d-0000-4000-8000-000000000001',
    name: 'Acme',
    slug: 'acme',
    environment: 'sandbox',
  } as const
  const deliveries = Deliveries.of({
    record: () => Effect.void,
    await: () => Effect.succeedNone,
  })
  const run = (args: string[]) => {
    const cli = runCli(listen, args)
    const organizations = fakeOrganizations({
      items: [acme],
      selected: { id: acme.id, environment: acme.environment },
    })
    const promise = Effect.runPromise(
      cli.effect.pipe(
        Effect.provideService(Auth, fakeAuth().auth),
        Effect.provideService(Organizations, organizations.organizations),
        Effect.provideService(Deliveries, deliveries),
        Effect.provide(FetchHttpClient.layer),
      ),
    )
    return { promise, output: cli.output }
  }

  test('stops at a host that does not exist', async () => {
    await expect(run(['qweqe.invalid']).promise).rejects.toThrow(
      'Can\'t find a host named "qweqe.invalid". To forward to a server on this machine, pass its port, e.g. `polar listen 3000`.',
    )
  })

  test('shows examples in its help', async () => {
    const { promise, output } = run(['--help'])
    await promise
    expect(stripAnsi(output())).toContain('polar listen 3000')
  })

  test('prints the signing secret of the active organization', async () => {
    const { promise, output } = run(['--print-secret'])
    await promise
    expect(output()).toBe('1a2b3c4d000040008000000000000001')
  })

  test('asks for a forward target', async () => {
    await expect(run([]).promise).rejects.toThrow(
      'Pass a port or URL to forward events to, e.g. `polar listen 3000`.',
    )
  })

  test('rejects a target that is not a port or http URL', async () => {
    await expect(run(['ftp://localhost/hooks']).promise).rejects.toThrow(
      'is not a port or an http(s) URL',
    )
  })
})
