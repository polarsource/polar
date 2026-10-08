import { afterEach, expect, test, vi } from 'vitest'
import { assertBenefitDeployed, findBenefitGrant } from './benefits'
import { createPolar } from '../../sdk'

afterEach(() => vi.restoreAllMocks())

const sdk = createPolar({ accessToken: 'test' })

test('looks up the grant by benefit external ID in one request', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ items: [{ id: 'grant-id' }] }))

  await expect(
    findBenefitGrant(
      sdk,
      {
        external_customer_id: 'customer-1',
        external_member_id: 'member-1',
      },
      'custom_servers',
    ),
  ).resolves.toEqual({ id: 'grant-id' })

  expect(fetch).toHaveBeenCalledOnce()
  const url = new URL(String(fetch.mock.calls[0]?.[0]))
  expect(url.pathname).toBe('/v1/benefit-grants/')
  expect(Object.fromEntries(url.searchParams)).toEqual({
    external_customer_id: 'customer-1',
    external_member_id: 'member-1',
    external_benefit_id: 'custom_servers',
    is_granted: 'true',
    page: '1',
    limit: '1',
    sorting: '-created_at',
  })
})

test('returns undefined when the customer has no grant', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ items: [] }))

  await expect(
    findBenefitGrant(sdk, { customer_id: 'customer-1' }, 'custom_servers'),
  ).resolves.toBeUndefined()
})

test.each([
  [[{ id: 'benefit-id', external_id: 'custom_servers' }], undefined],
  [[{ id: 'benefit-id', external_id: 'other' }], 'not deployed'],
  [
    [
      { id: 'benefit-1', external_id: 'custom_servers' },
      { id: 'benefit-2', external_id: 'custom_servers' },
    ],
    'ambiguous',
  ],
])('checks benefit %j is deployed', async (items, message) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ items, pagination: { total_count: 1, max_page: 1 } }),
  )
  const check = assertBenefitDeployed(sdk, 'custom_servers')
  if (message === undefined) {
    await expect(check).resolves.toBeUndefined()
  } else {
    await expect(check).rejects.toThrow(message)
  }
})
