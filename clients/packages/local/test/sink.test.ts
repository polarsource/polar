import { describe, expect, test } from 'vitest'
import { Effect, Exit } from 'effect'
import type { UsageEvent } from '../src/events'
import { polarClient } from '../src/polar-client'
import { polarSink } from '../src/sink'
import type { EventCreateExternalCustomer, PolarEvent } from '../src/polar'
import { fakePolarClient } from './fake-polar'

/** A Polar-shaped event with our internal envelope. */
const event = (over: Partial<Record<string, unknown>> = {}): UsageEvent =>
  ({
    kind: 'usage',
    v: 1,
    seq: 1,
    id: 'evt_1',
    name: 'tokens',
    external_customer_id: 'acme',
    timestamp: '2026-01-15T12:00:00.000Z',
    external_id: 'idem-1',
    metadata: { amount: 1500 },
    ...over,
  }) as UsageEvent

/** The events array sent in the (single) ingest call's body. */
const sentEvents = (calls: { opts: { body?: any } }[]) =>
  calls[0]!.opts.body.events as PolarEvent[]

const run = <A, E>(eff: Effect.Effect<A, E>) => Effect.runPromiseExit(eff)

describe('polarSink — request mapping (forward the Polar-shaped event)', () => {
  test('forwards the event verbatim and strips the internal envelope', async () => {
    const { client, calls } = fakePolarClient(() => ({
      data: { inserted: 1, duplicates: 0 },
    }))
    await run(polarSink({ client }).send([event()]))

    expect(calls[0]!.path).toBe('/v1/events/ingest')
    const ev = sentEvents(calls)[0] as EventCreateExternalCustomer
    expect(ev).toEqual({
      name: 'tokens',
      external_customer_id: 'acme',
      timestamp: '2026-01-15T12:00:00.000Z',
      external_id: 'idem-1',
      metadata: { amount: 1500 },
    })
    for (const k of ['kind', 'seq', 'id', 'v']) expect(ev).not.toHaveProperty(k)
  })

  test('a customer_id (Polar UUID) event is forwarded as customer_id', async () => {
    const { client, calls } = fakePolarClient(() => ({ data: { inserted: 1 } }))
    await run(
      polarSink({ client }).send([
        event({ external_customer_id: undefined, customer_id: 'cus_123' }),
      ]),
    )
    expect(sentEvents(calls)[0]).toHaveProperty('customer_id', 'cus_123')
  })

  test('organizationId is injected only when the event lacks one', async () => {
    const { client, calls } = fakePolarClient(() => ({ data: { inserted: 2 } }))
    await run(
      polarSink({ client, organizationId: 'org_1' }).send([
        event(),
        event({ external_id: 'idem-2', organization_id: 'org_explicit' }),
      ]),
    )
    const [a, b] = sentEvents(calls)
    expect((a as PolarEvent).organization_id).toBe('org_1')
    expect((b as PolarEvent).organization_id).toBe('org_explicit')
  })

  test('a custom mapEvent overrides the default mapping', async () => {
    const { client, calls } = fakePolarClient(() => ({ data: { inserted: 1 } }))
    await run(
      polarSink({
        client,
        mapEvent: (e) => ({
          name: 'custom',
          external_customer_id: 'x',
          external_id: e.external_id,
          metadata: {},
        }),
      }).send([event()]),
    )
    expect(sentEvents(calls)[0]).toMatchObject({
      name: 'custom',
      external_customer_id: 'x',
    })
  })
})

describe('polarClient factory', () => {
  test('targets the right host per environment', () => {
    expect(polarClient({ token: 't' }).baseUrl).toBe('https://api.polar.sh')
    expect(polarClient({ token: 't', server: 'sandbox' }).baseUrl).toBe(
      'https://sandbox-api.polar.sh',
    )
    expect(
      polarClient({ token: 't', baseUrl: 'http://localhost:9999' }).baseUrl,
    ).toBe('http://localhost:9999')
  })
})

describe('polarSink — response & error classification', () => {
  test('200 returns inserted/duplicates from the response', async () => {
    const { client } = fakePolarClient(() => ({
      data: { inserted: 3, duplicates: 2 },
    }))
    const exit = await run(
      polarSink({ client }).send([event(), event(), event()]),
    )
    expect(exit._tag).toBe('Success')
    if (Exit.isSuccess(exit))
      expect(exit.value).toEqual({ accepted: 3, duplicates: 2 })
  })

  test('422 → BatchRejected (permanent) with a parsed validation message', async () => {
    const detail = [
      {
        loc: ['body', 'events', 0, 'name'],
        msg: 'String should have at most 128 characters',
      },
    ]
    const { client } = fakePolarClient(() => ({
      status: 422,
      error: { detail },
    }))
    const exit = await run(polarSink({ client }).send([event()]))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
      expect(exit.cause.error._tag).toBe('BatchRejected')
      expect(exit.cause.error.message).toContain('body.events.0.name')
    }
  })

  test('429 → ApiUnavailable (transient) carrying Retry-After', async () => {
    const { client } = fakePolarClient(() => ({
      status: 429,
      headers: { 'Retry-After': '30' },
    }))
    const exit = await run(polarSink({ client }).send([event()]))
    if (
      Exit.isFailure(exit) &&
      exit.cause._tag === 'Fail' &&
      exit.cause.error._tag === 'ApiUnavailable'
    ) {
      expect(exit.cause.error.status).toBe(429)
      expect(exit.cause.error.retryAfter).toBe(30)
    }
  })

  test('500, 401, 404 are transient (buffered, never dead-lettered)', async () => {
    for (const status of [500, 401, 404]) {
      const { client } = fakePolarClient(() => ({ status }))
      const exit = await run(polarSink({ client }).send([event()]))
      if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
        expect(exit.cause.error._tag).toBe('ApiUnavailable')
      }
    }
  })

  test("a network throw → ApiUnavailable(status: 'network')", async () => {
    const { client } = fakePolarClient(() => {
      throw new Error('ECONNREFUSED')
    })
    const exit = await run(polarSink({ client }).send([event()]))
    if (
      Exit.isFailure(exit) &&
      exit.cause._tag === 'Fail' &&
      exit.cause.error._tag === 'ApiUnavailable'
    ) {
      expect(exit.cause.error.status).toBe('network')
    }
  })
})

describe('polarSink — local pre-validation against Polar limits', () => {
  test('an over-long name is rejected locally without calling the API', async () => {
    const { client, calls } = fakePolarClient(() => ({ data: { inserted: 1 } }))
    const exit = await run(
      polarSink({ client }).send([event({ name: 'x'.repeat(129) })]),
    )
    expect(calls).toHaveLength(0) // never hit the API
    if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
      expect(exit.cause.error._tag).toBe('BatchRejected')
      expect(exit.cause.error.message).toContain('name exceeds 128')
    }
  })
})
