import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { RuntimeSDKConfig } from '../schema/config'
import type { Polar } from '../sdk'
import { createActor } from './actor'

const config = {
  benefits: { custom_meters: { id: 'benefit-id' } },
} as const satisfies RuntimeSDKConfig

describe('actor benefits', () => {
  it('accepts only configured benefit names', () => {
    const actor = createActor(
      config,
      {} as Polar,
    )({ customerId: 'customer-id' })
    expectTypeOf(actor.benefits.has)
      .parameter(0)
      .toEqualTypeOf<'custom_meters'>()
    expectTypeOf(actor.benefits.has).returns.toEqualTypeOf<Promise<boolean>>()
    const unconfigured = createActor(
      {},
      {} as Polar,
    )({ customerId: 'customer-id' })
    expectTypeOf(unconfigured.benefits.has).parameter(0).toEqualTypeOf<never>()
  })

  it.each([
    { customerId: 'customer-id' },
    { externalCustomerId: 'external-customer-id' },
  ])('checks granted benefits for %j across all pages', async (identifier) => {
    const iterGrants = vi.fn(async function* () {
      yield { benefit_id: 'benefit-id' }
    })
    const getExternal = vi.fn().mockResolvedValue({ id: 'customer-id' })
    const sdk = {
      benefits: { iterGrants },
      customers: { getExternal },
    } as unknown as Polar
    const actor = createActor(config, sdk)(identifier)

    await expect(actor.benefits.has('custom_meters')).resolves.toBe(true)
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
      }
    })
    const sdk = { benefits: { iterGrants } } as unknown as Polar
    const actor = createActor(
      config,
      sdk,
    )({ customerId: 'customer-id', ...identifier })

    await expect(actor.benefits.has('custom_meters')).resolves.toBe(true)
  })

  it('returns false when no matching grant exists', async () => {
    const iterGrants = vi.fn(async function* () {})
    const sdk = { benefits: { iterGrants } } as unknown as Polar
    const actor = createActor(config, sdk)({ customerId: 'customer-id' })

    await expect(actor.benefits.has('custom_meters')).resolves.toBe(false)
  })
})

const metersConfig = {
  meters: {
    tool_call: {
      filter: {
        conjunction: 'and',
        clauses: [
          {
            conjunction: 'or',
            clauses: [{ property: 'name', operator: 'eq', value: 'tool_call' }],
          },
        ],
      },
      aggregation: { func: 'count' },
    },
  },
} as const satisfies RuntimeSDKConfig

describe('actor meters', () => {
  it('resolves the meter by external ID once and reads its customer meter', async () => {
    const getExternal = vi.fn().mockResolvedValue({ id: 'meter-id' })
    const list = vi.fn().mockResolvedValue({ items: [{ balance: 42 }] })
    const sdk = {
      meters: { getExternal },
      customerMeters: { list },
    } as unknown as Polar
    const actor = createActor(metersConfig, sdk)

    for (const externalCustomerId of ['customer-a', 'customer-b']) {
      await expect(
        actor({ externalCustomerId }).meters.tool_call.balance(),
      ).resolves.toEqual({ balance: 42, isPristine: true })
      expect(list).toHaveBeenLastCalledWith({
        external_customer_id: externalCustomerId,
        meter_id: 'meter-id',
      })
    }
    expect(getExternal).toHaveBeenCalledTimes(1)
    expect(getExternal).toHaveBeenCalledWith('tool_call')
  })

  it('retries the meter lookup after a failure', async () => {
    const getExternal = vi
      .fn()
      .mockRejectedValueOnce(new Error('Meter not found'))
      .mockResolvedValue({ id: 'meter-id' })
    const list = vi.fn().mockResolvedValue({ items: [] })
    const sdk = {
      meters: { getExternal },
      customerMeters: { list },
    } as unknown as Polar
    const actor = createActor(metersConfig, sdk)({ customerId: 'customer-id' })

    await expect(actor.meters.tool_call.balance()).rejects.toThrow(
      'Meter not found',
    )
    await expect(actor.meters.tool_call.balance()).resolves.toEqual({
      balance: 0,
      isPristine: true,
    })
    expect(getExternal).toHaveBeenCalledTimes(2)
  })
})
