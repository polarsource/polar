import { afterEach, expect, expectTypeOf, test, vi } from 'vitest'
import { RuntimeSDK } from './runtime'
import { defineConfig } from './schema/config'
import { and, eq, gte } from './schema/meter'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

test('defined configs connect lazily, resolve deployed IDs, and track metadata events', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  let modifiedAt = '2026-10-01T11:00:00Z'
  let meterRequests = 0
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/meters/')) {
        meterRequests++
        const page = Number(url.searchParams.get('page'))
        expect(url.searchParams.get('is_archived')).toBe('false')
        return Response.json({
          items:
            page === 1
              ? []
              : [{ id: 'deployed-tokens', external_id: 'tokens' }],
          pagination: { max_page: 2 },
        })
      }
      if (url.pathname.endsWith('/customer-meters/')) {
        expect(url.searchParams.get('meter_id')).toBe('deployed-tokens')
        expect(url.searchParams.get('external_customer_id')).toBe('customer-1')
        return Response.json({
          items: [
            { balance: 10, created_at: modifiedAt, modified_at: modifiedAt },
          ],
        })
      }
      if (url.pathname.endsWith('/events/ingest')) {
        const body = JSON.parse(String(init?.body))
        expect(body.events[0]).toMatchObject({
          external_customer_id: 'customer-1',
          external_member_id: 'member-1',
          metadata: { inputTokens: 1500 },
        })
        return Response.json({ inserted: 1 })
      }
      throw new Error(`Unexpected request ${url}`)
    })
  const config = defineConfig({
    meters: ({ meter }) => ({
      tokens: meter({ displayName: 'Tokens' })
        .where(and(eq('name', 'llm.completion'), gte('inputTokens', 1000)))
        .sum('inputTokens'),
    }),
  })
  const json = config.toJSON()
  const client = RuntimeSDK(config, {
    accessToken: 'test',
    environment: 'sandbox',
  })
  const customer = client.actor({
    externalCustomerId: 'customer-1',
    externalMemberId: 'member-1',
  })
  expectTypeOf(customer.balance).parameter(0).toEqualTypeOf<'tokens'>()
  expect(fetch).not.toHaveBeenCalled()
  expect(await customer.balance('tokens')).toEqual({
    balance: 10,
    pristine: true,
  })
  await customer.track('unrelated', { inputTokens: 1500 })
  expect((await customer.balance('tokens')).pristine).toBe(true)
  await customer.track('llm.completion', { inputTokens: 1500 })
  expect((await customer.balance('tokens')).pristine).toBe(false)
  modifiedAt = '2026-10-01T12:00:01Z'
  expect((await customer.balance('tokens')).pristine).toBe(true)
  expect(meterRequests).toBe(2)
  expect(config.toJSON()).toEqual(json)
})
