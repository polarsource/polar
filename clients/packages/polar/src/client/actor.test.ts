import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { z } from 'zod'
import type { RuntimeSDKConfig } from '../schema/runtime'
import { errors, type Polar } from '../sdk'
import { createActor, EventValidationError } from './actor'

const config = {
  benefits: { custom_meters: {} },
} as const satisfies RuntimeSDKConfig

describe('actor benefits', () => {
  it('accepts only configured benefit names', () => {
    const actor = createActor(
      config,
      {} as Polar,
    )({ customerId: 'customer-id' })
    expectTypeOf(actor.access).parameter(0).toEqualTypeOf<'custom_meters'>()
    const unconfigured = createActor(
      {},
      {} as Polar,
    )({ customerId: 'customer-id' })
    expectTypeOf(unconfigured.access).parameter(0).toEqualTypeOf<never>()
  })

  it.each([
    [{ customerId: 'customer-id' }, { customer_id: 'customer-id' }],
    [
      { externalCustomerId: 'external-customer-id' },
      { external_customer_id: 'external-customer-id' },
    ],
  ])('checks granted benefits for %j', async (identifier, query) => {
    const list = vi.fn().mockResolvedValue({
      items: [{ benefit: { metadata: { seats: 5 } } }],
    })
    const sdk = { benefitGrants: { list } } as unknown as Polar
    const actor = createActor(config, sdk)(identifier)

    await expect(actor.access('custom_meters')).resolves.toEqual({
      granted: true,
      metadata: { seats: 5 },
    })
    expect(list).toHaveBeenCalledWith({
      ...query,
      external_benefit_id: 'custom_meters',
      is_granted: true,
      limit: 1,
    })
  })

  it.each([
    [{ memberId: 'member-id' }, { member_id: 'member-id' }],
    [
      { externalMemberId: 'external-member-id' },
      { external_member_id: 'external-member-id' },
    ],
  ])('checks the specified member %j', async (identifier, query) => {
    const list = vi.fn().mockResolvedValue({
      items: [{ benefit: { metadata: {} } }],
    })
    const sdk = { benefitGrants: { list } } as unknown as Polar
    const actor = createActor(
      config,
      sdk,
    )({ customerId: 'customer-id', ...identifier })

    await expect(actor.access('custom_meters')).resolves.toEqual({
      granted: true,
      metadata: {},
    })
    expect(list).toHaveBeenCalledWith({
      customer_id: 'customer-id',
      ...query,
      external_benefit_id: 'custom_meters',
      is_granted: true,
      limit: 1,
    })
  })

  it('returns not granted when no matching grant exists', async () => {
    const list = vi.fn().mockResolvedValue({ items: [] })
    const iterList = vi.fn(async function* () {
      yield { external_id: 'custom_meters' }
    })
    const sdk = {
      benefitGrants: { list },
      benefits: { iterList },
    } as unknown as Polar
    const actor = createActor(config, sdk)({ customerId: 'customer-id' })

    await expect(actor.access('custom_meters')).resolves.toEqual({
      granted: false,
    })
    await actor.access('custom_meters')
    expect(iterList).toHaveBeenCalledOnce()
  })

  it('rejects a benefit that is not deployed', async () => {
    const list = vi.fn().mockResolvedValue({ items: [] })
    const iterList = vi.fn(async function* () {})
    const sdk = {
      benefitGrants: { list },
      benefits: { iterList },
    } as unknown as Polar
    const actor = createActor(config, sdk)({ customerId: 'customer-id' })

    await expect(actor.access('custom_meters')).rejects.toThrow('not deployed')
  })
})

describe('actor events', () => {
  const events = {
    tool_call: z.object({
      tool: z.enum(['search', 'fetch']),
      durationMs: z.int(),
      region: z.string().default('eu'),
    }),
    heartbeat: z.object({ note: z.string().optional() }),
    legacy: {},
  } as const satisfies RuntimeSDKConfig['events']

  const setup = () => {
    const ingest = vi.fn().mockResolvedValue({ inserted: 1 })
    const sdk = { events: { ingest } } as unknown as Polar
    const actor = createActor({ events }, sdk)({ customerId: 'customer-id' })
    return { actor, ingest }
  }

  it('types metadata from the event schema', () => {
    const { actor } = setup()
    expectTypeOf(actor.track<'tool_call'>)
      .parameter(1)
      .toEqualTypeOf<{
        tool: 'search' | 'fetch'
        durationMs: number
        region?: string | undefined
      }>()
    expectTypeOf(actor.track<'heartbeat'>)
      .parameter(1)
      .toEqualTypeOf<{ note?: string | undefined } | undefined>()
    const typeOnly = () => {
      // @ts-expect-error metadata is required
      void actor.track('tool_call')
      // @ts-expect-error durationMs must be a number
      void actor.track('tool_call', { tool: 'search', durationMs: '1' })
      // @ts-expect-error undeclared event
      void actor.track('nope')
    }
    expectTypeOf(typeOnly).toBeFunction()
  })

  it('ingests the validated output of the event schema', async () => {
    const { actor, ingest } = setup()
    await actor.track('tool_call', { tool: 'search', durationMs: 12 })
    await actor.track('heartbeat')
    expect(ingest.mock.calls.map(([body]) => body.events[0])).toMatchObject([
      {
        name: 'tool_call',
        metadata: { tool: 'search', durationMs: 12, region: 'eu' },
      },
      { name: 'heartbeat', metadata: {} },
    ])
  })

  it('rejects invalid metadata before ingesting', async () => {
    const { actor, ingest } = setup()
    const tracked = actor.track('tool_call', {
      tool: 'search',
      durationMs: 1.5,
    })
    await expect(tracked).rejects.toBeInstanceOf(EventValidationError)
    await expect(tracked).rejects.toThrow(
      /^Invalid metadata for event "tool_call"\n.+\n {2}at \["durationMs"\]$/,
    )
    expect(ingest).not.toHaveBeenCalled()
  })

  it('passes metadata through for events without a schema', async () => {
    const { actor, ingest } = setup()
    await actor.track('legacy', { anything: 1 })
    expect(ingest.mock.calls[0]?.[0].events[0]).toMatchObject({
      name: 'legacy',
      metadata: { anything: 1 },
    })
  })

  it('ingests an array of events in a single request', async () => {
    const { actor, ingest } = setup()
    await actor.track([
      { name: 'tool_call', metadata: { tool: 'search', durationMs: 12 } },
      { name: 'heartbeat' },
      { name: 'legacy', metadata: { anything: 1 } },
    ])
    expect(ingest).toHaveBeenCalledOnce()
    expect(ingest.mock.calls[0]?.[0].events).toMatchObject([
      {
        name: 'tool_call',
        metadata: { tool: 'search', durationMs: 12, region: 'eu' },
      },
      { name: 'heartbeat', metadata: {} },
      { name: 'legacy', metadata: { anything: 1 } },
    ])
    const typeOnly = () => {
      // @ts-expect-error metadata is required
      void actor.track([{ name: 'tool_call' }])
      void actor.track([
        // @ts-expect-error durationMs must be a number
        { name: 'tool_call', metadata: { tool: 'search', durationMs: '1' } },
      ])
    }
    expectTypeOf(typeOnly).toBeFunction()
  })

  it('rejects the whole array when any event is invalid', async () => {
    const { actor, ingest } = setup()
    await expect(
      actor.track([
        { name: 'tool_call', metadata: { tool: 'search', durationMs: 12 } },
        { name: 'tool_call', metadata: { tool: 'search', durationMs: 1.5 } },
      ]),
    ).rejects.toBeInstanceOf(EventValidationError)
    expect(ingest).not.toHaveBeenCalled()
  })

  it('rejects undeclared events at runtime', async () => {
    const { actor, ingest } = setup()
    await expect(actor.track('nope' as 'legacy')).rejects.toThrow(
      'Unknown event: nope',
    )
    await expect(actor.track('toString' as 'legacy')).rejects.toThrow(
      'Unknown event: toString',
    )
    expect(ingest).not.toHaveBeenCalled()
  })
})

describe('actor grants', () => {
  const meters = {
    tool_call: {
      filter: {
        conjunction: 'and',
        clauses: [{ property: 'name', operator: 'eq', value: 'tool_call' }],
      },
      aggregation: { func: 'count' },
    },
  } as const satisfies RuntimeSDKConfig['meters']

  const setup = () => {
    const credits = vi
      .fn()
      .mockResolvedValue({ timestamp: '2026-10-01T12:00:00Z' })
    const list = vi.fn()
    const getExternal = vi
      .fn()
      .mockResolvedValue({ id: 'meter-id', archived_at: null })
    const sdk = {
      customerMeters: { credits, list },
      meters: { getExternal },
    } as unknown as Polar
    return { actor: createActor({ meters }, sdk), credits, list, getExternal }
  }

  it('accepts only configured meter names', () => {
    const { actor } = setup()
    expectTypeOf(actor({ customerId: 'customer-id' }).grant)
      .parameter(0)
      .toEqualTypeOf<'tool_call'>()
  })

  it.each([
    [
      { customerId: 'customer-id' },
      { customer_id: 'customer-id', meter_id: 'meter-id' },
    ],
    [
      { externalCustomerId: 'external-customer-id' },
      {
        external_customer_id: 'external-customer-id',
        external_meter_id: 'tool_call',
      },
    ],
  ])('credits the customer %j without rollover', async (identifier, body) => {
    const { actor, credits } = setup()

    await actor(identifier).grant('tool_call', 100)
    expect(credits).toHaveBeenCalledWith({
      ...body,
      units: 100,
      rollover: false,
    })
  })

  it('credits the customer of a member actor', async () => {
    const { actor, credits } = setup()

    await actor({
      externalCustomerId: 'external-customer-id',
      externalMemberId: 'external-member-id',
    }).grant('tool_call', 100)
    expect(credits).toHaveBeenCalledWith({
      external_customer_id: 'external-customer-id',
      external_meter_id: 'tool_call',
      units: 100,
      rollover: false,
    })
  })

  it('passes rollover and the idempotency key', async () => {
    const { actor, credits } = setup()

    await actor({ customerId: 'customer-id' }).grant('tool_call', 100, {
      rollover: true,
      idempotencyKey: 'order-1',
    })
    expect(credits).toHaveBeenCalledWith({
      customer_id: 'customer-id',
      meter_id: 'meter-id',
      units: 100,
      rollover: true,
      external_id: 'order-1',
    })
  })

  it('reports the balance as not pristine until the credit is applied', async () => {
    const { actor, list } = setup()
    const customer = actor({ customerId: 'customer-id' })
    const customerMeter = (modifiedAt: string, balance: number) => ({
      items: [{ balance, created_at: modifiedAt, modified_at: modifiedAt }],
    })

    await customer.grant('tool_call', 100)

    list.mockResolvedValueOnce(customerMeter('2026-10-01T11:59:59Z', 0))
    await expect(customer.balance('tool_call')).resolves.toEqual({
      balance: 0,
      pristine: false,
    })
    list.mockResolvedValueOnce(customerMeter('2026-10-01T12:00:01Z', 100))
    await expect(customer.balance('tool_call')).resolves.toEqual({
      balance: 100,
      pristine: true,
    })
  })

  it('rejects undeclared meters at runtime', async () => {
    const { actor, credits } = setup()

    await expect(
      actor({ customerId: 'customer-id' }).grant('nope' as 'tool_call', 100),
    ).rejects.toThrow('Unknown meter: nope')
    expect(credits).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5, Number.NaN, 1_000_000_001])(
    'rejects %d units',
    async (units) => {
      const { actor, credits } = setup()

      await expect(
        actor({ customerId: 'customer-id' }).grant('tool_call', units),
      ).rejects.toThrow('Units must be a whole number')
      expect(credits).not.toHaveBeenCalled()
    },
  )

  it.each([
    { customerId: 'customer-id' },
    { externalCustomerId: 'external-customer-id' },
  ])('rejects a meter that is not deployed for %j', async (identifier) => {
    const credits = vi.fn()
    const getExternal = vi.fn().mockRejectedValue(
      new errors.ResourceNotFound(404, {
        error: 'ResourceNotFound',
        detail: 'Not found',
      }),
    )
    const sdk = {
      customerMeters: { credits },
      meters: { getExternal },
    } as unknown as Polar
    const customer = createActor({ meters }, sdk)(identifier)

    await expect(customer.grant('tool_call', 100)).rejects.toThrow(
      'not deployed',
    )
    expect(credits).not.toHaveBeenCalled()
  })

  it('looks up a meter once per actor', async () => {
    const { actor, getExternal } = setup()

    await actor({ customerId: 'customer-id' }).grant('tool_call', 100)
    await actor({ customerId: 'other-customer-id' }).grant('tool_call', 100)
    expect(getExternal).toHaveBeenCalledTimes(1)
  })
})
