import { beforeEach, describe, expect, test } from 'vitest'
import { Effect, Option } from 'effect'
import { trigger as triggerCommand } from '@/commands/trigger'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Deliveries, type Delivery } from '@/services/deliveries'
import { Organizations } from '@/services/organizations'
import {
  NoActiveListener,
  PayloadRejected,
  Trigger,
  TriggerError,
  UnknownEvent,
} from '@/services/trigger'
import {
  keys,
  runCli,
  type RunCliOptions,
  stripAnsi,
} from '@/utils/test-utils/cli'
import { fakeOrganizations, fakeTrigger } from '@/utils/test-utils/services'

const fakeDeliveries = (results: Record<string, Delivery> = {}) => {
  const state = {
    results,
    recorded: [] as Array<{ eventId: string; delivery: Delivery }>,
  }
  const deliveries = Deliveries.of({
    record: (eventId, delivery) =>
      Effect.sync(() => {
        state.recorded.push({ eventId, delivery })
      }),
    await: (eventId) =>
      Effect.sync(() => Option.fromNullishOr(state.results[eventId])),
  })
  return { deliveries, state }
}

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}
const beta: ActiveOrganization = {
  id: 'org-2',
  name: 'Beta',
  slug: 'beta',
  environment: 'production',
}
const catalog = [
  { type: 'checkout.created', description: 'Sent when a checkout is created.' },
  { type: 'order.paid', description: 'Sent when an order is paid.' },
]

let organizations: ReturnType<typeof fakeOrganizations>
let trigger: ReturnType<typeof fakeTrigger>
let deliveries: ReturnType<typeof fakeDeliveries>

const run = (args: string[], options?: RunCliOptions) => {
  const cli = runCli(triggerCommand, args, options)
  const promise = Effect.runPromise(
    cli.effect.pipe(
      Effect.provideService(Organizations, organizations.organizations),
      Effect.provideService(Trigger, trigger.trigger),
      Effect.provideService(Deliveries, deliveries.deliveries),
    ),
  )
  return { promise, output: cli.output }
}

beforeEach(() => {
  organizations = fakeOrganizations({
    items: [acme, beta],
    selected: { id: acme.id, environment: acme.environment },
  })
  trigger = fakeTrigger({ events: catalog })
  deliveries = fakeDeliveries()
})

describe('trigger', () => {
  test('sends the event to the active organization', async () => {
    const { promise, output } = run(['order.created'])
    await promise

    expect(trigger.state.sent).toEqual([
      {
        organization: acme,
        request: { event: 'order.created', overrides: {}, deliver: true },
      },
    ])
    expect(output()).toContain('Sent order.created to Acme (sandbox)')
    expect(output()).toContain('evt-1')
  })

  test('shows where the event went and what your server answered', async () => {
    deliveries.state.results['evt-1'] = {
      forwardUrl: 'http://localhost:3000/webhooks',
      status: 200,
      statusText: 'OK',
      durationMs: 6,
    }
    const { promise, output } = run(['order.created'])
    await promise

    expect(output()).toContain('Forwarded to  http://localhost:3000/webhooks')
    expect(output()).toContain('Response      200 OK  6ms')
  })

  test('fails and shows why forwarding failed', async () => {
    deliveries.state.results['evt-1'] = {
      forwardUrl: 'http://localhost:3000/webhooks',
      failure: 'connection refused, is your server running?',
      durationMs: 1,
    }
    const { promise, output } = run(['order.created'])

    await expect(promise).rejects.toThrow(
      'Your server did not accept order.created',
    )
    expect(output()).toContain(
      'Response      failed  connection refused, is your server running?',
    )
  })

  test('fails and shows the response body when your server rejects the event', async () => {
    deliveries.state.results['evt-1'] = {
      forwardUrl: 'http://localhost:3000/webhooks',
      status: 500,
      statusText: 'Internal Server Error',
      body: 'TypeError: order.customer is undefined\n    at handler',
      durationMs: 6,
    }
    const { promise, output } = run(['order.created'])

    await expect(promise).rejects.toThrow(
      'Your server did not accept order.created',
    )
    expect(output()).toContain('Response      500 Internal Server Error  6ms')
    expect(output()).toContain(
      '  TypeError: order.customer is undefined\n      at handler',
    )
  })

  test('points at the listen terminal when no outcome was reported', async () => {
    const { promise, output } = run(['order.created'])
    await promise

    expect(output()).toContain(
      'Forwarded by  your polar listen terminal, which shows the response',
    )
    expect(output()).not.toContain('Delivered to')
  })

  test('passes overrides, seed and --org through', async () => {
    const { promise } = run([
      'order.paid',
      '--org',
      'org-2',
      '--override',
      'data.customer.email=vip@example.com',
      '--seed',
      '42',
    ])
    await promise

    expect(trigger.state.sent[0]).toEqual({
      organization: beta,
      request: {
        event: 'order.paid',
        overrides: { 'data.customer.email': 'vip@example.com' },
        seed: 42,
        deliver: true,
      },
    })
  })

  test('prints the payload instead of delivering with --json', async () => {
    const { promise, output } = run(['order.created', '--json'])
    await promise

    expect(trigger.state.sent[0]?.request.deliver).toBe(false)
    expect(JSON.parse(output())).toEqual({
      type: 'order.created',
      data: { id: 'ord-1' },
    })
  })

  test('lets you pick an event interactively', async () => {
    const { promise, output } = run([], {
      interactive: true,
      input: [...keys.type('order.paid'), keys.enter],
    })
    await promise

    expect(trigger.state.sent[0]?.request.event).toBe('order.paid')
    expect(output()).toContain('Sent order.paid to Acme')
  })

  test('lists the catalog for the organization environment', async () => {
    const { promise, output } = run(['--list'])
    await promise

    expect(output()).toContain('checkout.created')
    expect(output()).toContain('Sent when an order is paid.')
    expect(trigger.state.sent).toHaveLength(0)
  })

  test('lists the catalog as JSON', async () => {
    const { promise, output } = run(['--list', '--json'])
    await promise

    expect(JSON.parse(output())).toEqual(catalog)
  })

  test('requires an event name when not interactive', async () => {
    const { promise } = run([])

    await expect(promise).rejects.toThrow('An event name is required')
    expect(trigger.state.sent).toHaveLength(0)
  })

  test('rejects malformed and duplicate overrides before resolving anything', async () => {
    await expect(
      run(['order.created', '--override', 'nope']).promise,
    ).rejects.toThrow('Invalid override')
    await expect(
      run(['order.created', '--override', 'a=1', '--override', 'a=2']).promise,
    ).rejects.toThrow('more than once')
    expect(trigger.state.sent).toHaveLength(0)
  })

  test.each([
    [
      new NoActiveListener({ organization: acme }),
      'Nothing is listening for Acme',
    ],
    [
      new UnknownEvent({ event: 'order.create', suggestion: 'order.created' }),
      'Did you mean polar trigger order.created',
    ],
    [new UnknownEvent({ event: 'payout.done' }), 'polar trigger --list'],
    [
      new PayloadRejected({
        detail: [{ loc: ['body', 'overrides', 'data', 'x'], msg: 'bad' }],
      }),
      'data.x: bad',
    ],
    [
      new TriggerError({ message: 'Could not reach the Polar API' }),
      'Could not reach',
    ],
  ])('explains %s', async (failure, expected) => {
    trigger.state.failure = failure
    const { promise } = run(['order.create'])

    const error = (await promise.then(
      () => undefined,
      (error: unknown) => error,
    )) as { message: string; hint?: string }
    expect(stripAnsi(`${error.message} ${error.hint ?? ''}`)).toContain(
      expected,
    )
  })

  test('explains when the catalog cannot be loaded', async () => {
    trigger.state.listFailure = new TriggerError({
      message: 'Could not reach the Polar API',
    })
    const { promise } = run(['--list'])

    await expect(promise).rejects.toThrow('Could not reach the Polar API')
  })
})
