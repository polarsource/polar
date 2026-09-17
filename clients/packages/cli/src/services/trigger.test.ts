import { beforeEach, describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { closestEvent, make } from '@/services/trigger'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}
const eventsUrl = 'https://sandbox-api.polar.sh/v1/cli/events'
const triggerUrl = 'https://sandbox-api.polar.sh/v1/cli/trigger/org-1'
const catalog = [
  { type: 'order.created', description: 'Created.' },
  { type: 'order.paid', description: 'Paid.' },
]

let api: ReturnType<typeof fakeHttp>

const service = () =>
  make.pipe(
    Effect.provide(api.layer),
    Effect.provideService(Auth, fakeAuth({ environment: 'sandbox' }).auth),
  )

const listEvents = () =>
  Effect.runPromise(
    service().pipe(Effect.flatMap((trigger) => trigger.listEvents('sandbox'))),
  )

const send = (
  overrides: Record<string, unknown> = {},
  event = 'order.created',
) =>
  Effect.runPromise(
    service().pipe(
      Effect.flatMap((trigger) =>
        trigger.send(acme, { event, overrides, deliver: true }),
      ),
    ),
  )

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected failure')
    },
    (error: unknown) =>
      error as { _tag: string; message?: string; hint?: string },
  )

beforeEach(() => {
  api = fakeHttp()
})

describe('closestEvent', () => {
  const events = [
    'order.created',
    'order.paid',
    'subscription.canceled',
    'benefit_grant.created',
  ]

  test.each([
    ['order.create', 'order.created'],
    ['order_created', 'order.created'],
    ['ORDER-PAID', 'order.paid'],
    ['subscripton.cancelled', 'subscription.canceled'],
    ['benefit-grant-created', 'benefit_grant.created'],
  ])('suggests %s -> %s', (input, expected) => {
    expect(closestEvent(input, events)).toBe(expected)
  })

  test('gives up when nothing is close', () => {
    expect(closestEvent('payout.completed', events)).toBeUndefined()
  })
})

describe('listEvents', () => {
  test('returns the catalog with the bearer token', async () => {
    api.routes[`GET ${eventsUrl}`] = Response.json(catalog)

    expect(await listEvents()).toEqual(catalog)
    expect(api.requests[0]!.headers.get('Authorization')).toBe('Bearer token')
  })

  test.each([
    [401, 'Authentication rejected for sandbox'],
    [403, 'You do not have access to this organization'],
    [503, 'returned an error (503)'],
  ])('maps a %d', async (status, message) => {
    api.routes[`GET ${eventsUrl}`] = new Response(null, { status })

    const error = await failure(listEvents())
    expect(error._tag).toBe('TriggerError')
    expect(error.message).toContain(message)
  })

  test('maps network failures', async () => {
    const error = await failure(listEvents())
    expect(error.message).toBe('Could not reach the Polar API')
  })
})

describe('send', () => {
  test('posts the request and maps the response', async () => {
    api.routes[`POST ${triggerUrl}`] = Response.json({
      webhook_event_id: 'evt-1',
      event: 'order.created',
      delivered: true,
      payload: { type: 'order.created' },
    })

    const result = await send({ 'data.amount': '5' })

    expect(result).toEqual({
      webhookEventId: 'evt-1',
      event: 'order.created',
      delivered: true,
      payload: { type: 'order.created' },
    })
    expect(await api.requests[0]!.clone().json()).toEqual({
      event: 'order.created',
      overrides: { 'data.amount': '5' },
      deliver: true,
    })
  })

  test('reports a missing listener', async () => {
    api.routes[`POST ${triggerUrl}`] = new Response(null, { status: 409 })

    expect((await failure(send()))._tag).toBe('NoActiveListener')
  })

  test('suggests the closest event when the API rejects the name', async () => {
    api.routes[`POST ${triggerUrl}`] = Response.json(
      { detail: [{ loc: ['body', 'event'], msg: 'enum' }] },
      { status: 422 },
    )
    api.routes[`GET ${eventsUrl}`] = Response.json(catalog)

    const error = await failure(send({}, 'order.create'))
    expect(error).toMatchObject({
      _tag: 'UnknownEvent',
      suggestion: 'order.created',
    })
    expect(api.requests).toHaveLength(2)
  })

  test('reports rejected payloads with their detail', async () => {
    api.routes[`POST ${triggerUrl}`] = Response.json(
      {
        detail: [{ loc: ['body', 'overrides', 'data', 'amount'], msg: 'bad' }],
      },
      { status: 422 },
    )

    const error = await failure(send({ 'data.amount': 'x' }))
    expect(error).toMatchObject({ _tag: 'PayloadRejected' })
  })

  test.each([
    [401, 'Authentication rejected for sandbox'],
    [404, 'could not be found in sandbox'],
    [418, 'unexpected status (418)'],
  ])('maps a %d', async (status, message) => {
    api.routes[`POST ${triggerUrl}`] = new Response(null, { status })

    expect((await failure(send())).message).toContain(message)
  })
})
