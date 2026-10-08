import { afterEach, expect, expectTypeOf, test, vi } from 'vitest'
import { z } from 'zod'
import { EventValidationError } from './client/actor'
import { RuntimeSDK } from './runtime'
import { defineConfig } from './schema/config'
import { and, eq, gte } from './schema/meter'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

test('defined configs connect lazily, read balances by external meter ID, and track metadata events', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  let modifiedAt = '2026-10-01T11:00:00Z'
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/customer-meters/')) {
        expect(url.searchParams.get('external_meter_id')).toBe('tokens')
        expect(url.searchParams.get('meter_id')).toBeNull()
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
      tokens: meter('Tokens')
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
  expect(config.toJSON()).toEqual(json)
})

test('connected configs validate and ingest typed events and track the meters they feed', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  const ingested: unknown[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/customer-meters/')) {
      const modifiedAt = '2026-10-01T11:00:00Z'
      return Response.json({
        items: [
          { balance: 1, created_at: modifiedAt, modified_at: modifiedAt },
        ],
      })
    }
    if (url.pathname.endsWith('/events/ingest')) {
      ingested.push(...JSON.parse(String(init?.body)).events)
      return Response.json({ inserted: 1 })
    }
    throw new Error(`Unexpected request ${url}`)
  })
  const config = defineConfig({
    events: {
      tool_call: z.object({
        tool: z.enum(['search', 'fetch']),
        durationMs: z.int(),
        region: z.string().default('eu'),
      }),
      'llm.completion': z.object({ model: z.string(), inputTokens: z.int() }),
    },
    meters: ({ meter, events }) => ({
      searches: meter()
        .on(events.tool_call)
        .where(eq(events.tool_call.tool, 'search'))
        .count(),
      completions: meter().on(events['llm.completion']).count(),
    }),
  })
  const customer = RuntimeSDK(config, {
    accessToken: 'test',
    environment: 'sandbox',
  }).actor({ externalCustomerId: 'customer-1' })
  const pristine = async () => ({
    searches: (await customer.balance('searches')).pristine,
    completions: (await customer.balance('completions')).pristine,
  })

  expectTypeOf(customer.track)
    .parameter(0)
    .toEqualTypeOf<'tool_call' | 'llm.completion'>()

  await customer.track('tool_call', { tool: 'fetch', durationMs: 5 })
  expect(await pristine()).toEqual({ searches: true, completions: true })

  await customer.track('tool_call', { tool: 'search', durationMs: 5 })
  expect(await pristine()).toEqual({ searches: false, completions: true })

  await customer.track('llm.completion', { model: 'claude', inputTokens: 10 })
  expect(await pristine()).toEqual({ searches: false, completions: false })

  await expect(
    customer.track('llm.completion', { model: 'claude', inputTokens: 1.5 }),
  ).rejects.toBeInstanceOf(EventValidationError)

  expect(ingested).toMatchObject([
    {
      name: 'tool_call',
      external_customer_id: 'customer-1',
      metadata: { tool: 'fetch', durationMs: 5, region: 'eu' },
    },
    {
      name: 'tool_call',
      metadata: { tool: 'search', durationMs: 5, region: 'eu' },
    },
    { name: 'llm.completion', metadata: { model: 'claude', inputTokens: 10 } },
  ])
})
