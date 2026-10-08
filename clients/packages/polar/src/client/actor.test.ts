import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { z } from 'zod'
import type { RuntimeSDKConfig } from '../schema/runtime'
import type { Polar } from '../sdk'
import { createActor, EventValidationError } from './actor'

const config = {
  benefits: { custom_meters: { id: 'benefit-id' } },
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
    { customerId: 'customer-id' },
    { externalCustomerId: 'external-customer-id' },
  ])('checks granted benefits for %j across all pages', async (identifier) => {
    const iterGrants = vi.fn(async function* () {
      yield { benefit_id: 'benefit-id', benefit: { metadata: { seats: 5 } } }
    })
    const getExternal = vi.fn().mockResolvedValue({ id: 'customer-id' })
    const sdk = {
      benefits: { iterGrants },
      customers: { getExternal },
    } as unknown as Polar
    const actor = createActor(config, sdk)(identifier)

    await expect(actor.access('custom_meters')).resolves.toEqual({
      granted: true,
      metadata: { seats: 5 },
    })
    expect(iterGrants).toHaveBeenCalledWith('benefit-id', {
      customer_id: 'customer-id',
      is_granted: true,
    })
    if ('externalCustomerId' in identifier) {
      expect(getExternal).toHaveBeenCalledWith(identifier.externalCustomerId)
    } else {
      expect(getExternal).not.toHaveBeenCalled()
    }
  })

  it.each([
    { memberId: 'member-id' },
    { externalMemberId: 'external-member-id' },
  ])('checks the specified member %j', async (identifier) => {
    const iterGrants = vi.fn(async function* () {
      yield { benefit_id: 'benefit-id', member_id: 'other-member' }
      yield {
        benefit_id: 'benefit-id',
        member_id: 'member-id',
        member: { external_id: 'external-member-id' },
        benefit: { metadata: {} },
      }
    })
    const sdk = { benefits: { iterGrants } } as unknown as Polar
    const actor = createActor(
      config,
      sdk,
    )({ customerId: 'customer-id', ...identifier })

    await expect(actor.access('custom_meters')).resolves.toEqual({
      granted: true,
      metadata: {},
    })
  })

  it('resolves the benefit ID by external ID once when none is configured', async () => {
    const iterList = vi.fn(async function* () {
      yield { id: 'other-id', external_id: 'other' }
      yield { id: 'benefit-id', external_id: 'custom_meters' }
    })
    const iterGrants = vi.fn(async function* () {
      yield { benefit_id: 'benefit-id', benefit: { metadata: {} } }
    })
    const sdk = { benefits: { iterList, iterGrants } } as unknown as Polar
    const actor = createActor(
      { benefits: { custom_meters: {} } },
      sdk,
    )({ customerId: 'customer-id' })

    await actor.access('custom_meters')
    await actor.access('custom_meters')
    expect(iterList).toHaveBeenCalledOnce()
    expect(iterGrants).toHaveBeenCalledWith('benefit-id', {
      customer_id: 'customer-id',
      is_granted: true,
    })
  })

  it('returns not granted when no matching grant exists', async () => {
    const iterGrants = vi.fn(async function* () {})
    const sdk = { benefits: { iterGrants } } as unknown as Polar
    const actor = createActor(config, sdk)({ customerId: 'customer-id' })

    await expect(actor.access('custom_meters')).resolves.toEqual({
      granted: false,
    })
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
    expect(ingest).not.toHaveBeenCalled()
  })
})
