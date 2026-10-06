import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { RuntimeSDKConfig } from '../schema/runtime'
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

  it('returns not granted when no matching grant exists', async () => {
    const iterGrants = vi.fn(async function* () {})
    const sdk = { benefits: { iterGrants } } as unknown as Polar
    const actor = createActor(config, sdk)({ customerId: 'customer-id' })

    await expect(actor.access('custom_meters')).resolves.toEqual({
      granted: false,
    })
  })
})
