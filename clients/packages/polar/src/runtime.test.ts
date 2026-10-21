import { afterEach, expect, expectTypeOf, test, vi } from 'vitest'
import { z } from 'zod'
import { EventValidationError } from './client/actor'
import { RuntimeSDK } from './runtime'
import { defineConfig } from './schema/config'
import { and, eq, gte } from './schema/meter'

afterEach(() => vi.restoreAllMocks())

const options = {
  accessToken: 'test',
  environment: 'sandbox',
  metering: { outpost: false },
} as const

test('defined configs connect lazily, read balances by deployed meter ID, and track metadata events', async () => {
  const ingested: unknown[] = []
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/meters/external/tokens')) {
        return Response.json({ id: 'meter-id', archived_at: null })
      }
      if (url.pathname.endsWith('/customer-meters/')) {
        expect(url.searchParams.get('meter_id')).toBe('meter-id')
        expect(url.searchParams.get('external_customer_id')).toBe('customer-1')
        return Response.json({ items: [{ balance: 10 }] })
      }
      if (url.pathname.endsWith('/events/ingest')) {
        ingested.push(...JSON.parse(String(init?.body)).events)
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
  const client = RuntimeSDK(config, options)
  const customer = client.actor({
    externalCustomerId: 'customer-1',
    externalMemberId: 'member-1',
  })
  expectTypeOf(customer.balance).parameter(0).toEqualTypeOf<'tokens'>()
  expect(fetch).not.toHaveBeenCalled()
  expect(await customer.balance('tokens')).toEqual({ balance: 10 })

  await customer.track('llm.completion', { inputTokens: 1500 })
  await client.flush()
  expect(ingested).toMatchObject([
    {
      name: 'llm.completion',
      external_customer_id: 'customer-1',
      external_member_id: 'member-1',
      metadata: { inputTokens: 1500 },
    },
  ])
  await client.close()
  expect(config.toJSON()).toEqual(json)
})

test('connected configs validate and track typed events', async () => {
  const ingested: unknown[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input))
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
  const client = RuntimeSDK(config, options)
  const customer = client.actor({ externalCustomerId: 'customer-1' })

  expectTypeOf(customer.track)
    .parameter(0)
    .extract<string>()
    .toEqualTypeOf<'tool_call' | 'llm.completion'>()

  await customer.track('tool_call', { tool: 'fetch', durationMs: 5 })
  await customer.track('tool_call', { tool: 'search', durationMs: 5 })
  await customer.track('llm.completion', { model: 'claude', inputTokens: 10 })
  await expect(
    customer.track('llm.completion', { model: 'claude', inputTokens: 1.5 }),
  ).rejects.toBeInstanceOf(EventValidationError)
  await client.flush()

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
  await client.close()
})

test('access types granted metadata from the benefit declared in the config', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    Response.json({
      items: [{ benefit: { metadata: { limit: 5, tier: 'pro' } } }],
    }),
  )
  const entries = defineConfig({
    meters: ({ meter }) => ({ calls: meter('Calls').count() }),
    benefits: ({ flag, credits }) => ({
      custom_servers: flag('Custom servers').metadata({
        limit: 5,
        tier: 'pro',
      }),
      tool_calls: credits('Tool calls')
        .meter('calls')
        .units(100)
        .metadata({ visible: true })
        .rollover(),
      plain: flag('Plain flag'),
      hidden: flag('Hidden flag').metadata({ seats: 3 }).private(),
    }),
  })
  const tuples = defineConfig({
    meters: () => ({}),
    benefits: ({ flag }) => [
      ['custom_servers', flag('Custom servers').metadata({ limit: 5 })],
    ],
  })
  const customer = RuntimeSDK(entries, options).actor({ customerId: 'c' })

  const access = await customer.access('custom_servers')
  expect(access).toEqual({ granted: true, metadata: { limit: 5, tier: 'pro' } })
  if (access.granted) {
    expectTypeOf(access.metadata).toEqualTypeOf<{
      readonly limit: number
      readonly tier: string
    }>()
  }
  expectTypeOf(customer.access<'tool_calls'>)
    .returns.resolves.extract<{ granted: true }>()
    .toEqualTypeOf<{ granted: true; metadata: { readonly visible: boolean } }>()
  expectTypeOf(customer.access<'hidden'>)
    .returns.resolves.extract<{ granted: true }>()
    .toEqualTypeOf<{ granted: true; metadata: { readonly seats: number } }>()
  expectTypeOf(customer.access<'plain'>)
    .returns.resolves.extract<{ granted: true }>()
    .toEqualTypeOf<{
      granted: true
      metadata: { [k: string]: string | number | boolean }
    }>()
  expectTypeOf(
    RuntimeSDK(tuples, options).actor({ customerId: 'c' })
      .access<'custom_servers'>,
  )
    .returns.resolves.extract<{ granted: true }>()
    .toEqualTypeOf<{ granted: true; metadata: { readonly limit: number } }>()
})
