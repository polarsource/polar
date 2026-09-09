import { beforeEach, describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import {
  describeValidationDetail,
  parseOverride,
  trigger as triggerCommand,
} from '@/commands/trigger'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { Organizations } from '@/services/organizations'
import { keys, runCli, type RunCliOptions } from '@/utils/test-utils/cli'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const acme: ActiveOrganization = { id: 'org-1', name: 'Acme', slug: 'acme' }
const triggerUrl = 'https://sandbox-api.polar.sh/v1/cli/trigger/org-1'
const eventsUrl = 'https://sandbox-api.polar.sh/v1/cli/events'

const triggered = (event = 'order.created') =>
  Response.json({
    webhook_event_id: 'evt-1',
    event,
    delivered: true,
    payload: { type: event, data: { id: 'ord-1' } },
  })

let auth: ReturnType<typeof fakeAuth>
let organizations: ReturnType<typeof fakeOrganizations>
let api: ReturnType<typeof fakeHttp>

const run = (args: string[], options?: RunCliOptions) => {
  const cli = runCli(triggerCommand, args, options)
  const promise = Effect.runPromise(
    cli.effect.pipe(
      Effect.provide(api.layer),
      Effect.provideService(Auth, auth.auth),
      Effect.provideService(Organizations, organizations.organizations),
    ),
  )
  return { promise, output: cli.output, terminal: cli.terminal }
}

const requestBody = async (index = 0) =>
  (await api.requests[index]!.clone().json()) as Record<string, unknown>

beforeEach(() => {
  auth = fakeAuth()
  organizations = fakeOrganizations({
    items: [acme],
    selected: { sandbox: acme.id },
  })
  api = fakeHttp()
})

describe('parseOverride', () => {
  test.each([
    ['data.amount=2000', ['data.amount', 2000]],
    [
      'data.customer.email=jane@example.com',
      ['data.customer.email', 'jane@example.com'],
    ],
    ['data.metadata.plan="pro"', ['data.metadata.plan', 'pro']],
    ['data.paid=true', ['data.paid', true]],
    ['data.discount=null', ['data.discount', null]],
    ['data.items.0.label=a=b', ['data.items.0.label', 'a=b']],
  ])('parses %s', async (input, expected) => {
    expect(await Effect.runPromise(parseOverride(input))).toEqual(expected)
  })

  test.each(['no-equals', '=value'])('rejects %s', async (input) => {
    const error = await Effect.runPromise(
      parseOverride(input).pipe(Effect.flip),
    )
    expect(error._tag).toBe('TriggerError')
    expect(error.hint).toContain('path=value')
  })
})

describe('describeValidationDetail', () => {
  test('lists field errors without the body and overrides prefix', () => {
    expect(
      describeValidationDetail([
        { loc: ['body', 'overrides', 'data', 'amount'], msg: 'not an int' },
        { loc: [], msg: 'unknown' },
      ]),
    ).toBe('data.amount: not an int\n    unknown')
  })

  test('stringifies non-list details', () => {
    expect(describeValidationDetail('boom')).toBe('boom')
  })
})

describe('trigger', () => {
  test('sends the event through the active listener', async () => {
    api.routes[`POST ${triggerUrl}`] = triggered()
    const { promise, output } = run(['order.created'])
    await promise

    expect(await requestBody()).toEqual({
      event: 'order.created',
      overrides: {},
      deliver: true,
    })
    expect(api.requests[0]!.headers.get('Authorization')).toBe('Bearer token')
    expect(output()).toContain('Sent order.created to Acme (sandbox)')
    expect(output()).toContain('evt-1')
  })

  test('passes overrides, seed and the production environment', async () => {
    organizations.state.selected.production = acme.id
    api.routes['POST https://api.polar.sh/v1/cli/trigger/org-1'] = triggered()
    const { promise } = run([
      'order.paid',
      '--production',
      '--override',
      'data.customer.email=vip@example.com',
      '--override',
      'data.subtotal_amount=5000',
      '--seed',
      '42',
    ])
    await promise

    expect(await requestBody()).toEqual({
      event: 'order.paid',
      overrides: {
        'data.customer.email': 'vip@example.com',
        'data.subtotal_amount': 5000,
      },
      seed: 42,
      deliver: true,
    })
  })

  test('prints the payload instead of delivering with --json', async () => {
    api.routes[`POST ${triggerUrl}`] = triggered()
    const { promise, output } = run(['order.created', '--json'])
    await promise

    expect(await requestBody()).toMatchObject({ deliver: false })
    expect(JSON.parse(output())).toEqual({
      type: 'order.created',
      data: { id: 'ord-1' },
    })
  })

  test('lets you pick an event interactively', async () => {
    api.routes[`GET ${eventsUrl}`] = Response.json([
      {
        type: 'checkout.created',
        description: 'Sent when a checkout is created.',
      },
      { type: 'order.paid', description: 'Sent when an order is paid.' },
    ])
    api.routes[`POST ${triggerUrl}`] = triggered('order.paid')
    const { promise, output } = run([], {
      interactive: true,
      input: [...keys.type('order.paid'), keys.enter],
    })
    await promise

    expect(await requestBody(1)).toMatchObject({ event: 'order.paid' })
    expect(output()).toContain('Sent order.paid to Acme')
  })

  test('requires an event name when not interactive', async () => {
    const { promise } = run([])

    await expect(promise).rejects.toThrow('An event name is required')
    expect(api.requests).toHaveLength(0)
  })

  test('explains that nothing is listening on 409', async () => {
    api.routes[`POST ${triggerUrl}`] = Response.json(
      { error: 'NoActiveListener', detail: 'No CLI is listening' },
      { status: 409 },
    )
    const { promise } = run(['order.created'])

    await expect(promise).rejects.toThrow('Nothing is listening for Acme')
  })

  test('surfaces validation errors from the API', async () => {
    api.routes[`POST ${triggerUrl}`] = Response.json(
      {
        error: 'PolarRequestValidationError',
        detail: [
          {
            loc: ['body', 'overrides', 'data', 'subtotal_amount'],
            msg: 'Input should be a valid integer',
          },
        ],
      },
      { status: 422 },
    )
    const { promise } = run([
      'order.created',
      '--override',
      'data.subtotal_amount=abc',
    ])

    await expect(promise).rejects.toThrow('rejected the request')
  })

  test('reports unexpected statuses', async () => {
    api.routes[`POST ${triggerUrl}`] = new Response(null, { status: 500 })
    const { promise } = run(['order.created'])

    await expect(promise).rejects.toThrow('unexpected status (500)')
  })

  test('reports network failures', async () => {
    const { promise } = run(['order.created'])

    await expect(promise).rejects.toThrow('Could not reach the Polar API')
  })

  test('rejects malformed overrides before calling the API', async () => {
    const { promise } = run(['order.created', '--override', 'nope'])

    await expect(promise).rejects.toThrow('Invalid override')
    expect(api.requests).toHaveLength(0)
  })
})
