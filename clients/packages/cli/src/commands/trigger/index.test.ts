import { beforeEach, describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { trigger as triggerCommand } from '@/commands/trigger'
import type { ActiveOrganization } from '@/schemas/Auth'
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

const run = (args: string[], options?: RunCliOptions) => {
  const cli = runCli(triggerCommand, args, options)
  const promise = Effect.runPromise(
    cli.effect.pipe(
      Effect.provideService(Organizations, organizations.organizations),
      Effect.provideService(Trigger, trigger.trigger),
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
