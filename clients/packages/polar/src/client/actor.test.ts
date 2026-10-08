import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { RuntimeSDKConfig } from '../schema/runtime'
import type { Polar } from '../sdk'
import { createActor } from './actor'

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
