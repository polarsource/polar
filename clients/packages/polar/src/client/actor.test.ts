import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { z } from 'zod'
import type { RuntimeSDKConfig } from '../schema/runtime'
import type { Polar } from '../sdk'
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
