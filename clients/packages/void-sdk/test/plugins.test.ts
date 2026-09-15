import { assert, expect, it } from '@effect/vitest'
import {
  compile,
  defineConfig,
  event,
  meter,
  plugin,
  product,
  recurring,
  sum,
  usd,
} from '../src/index'
import { describePlan } from '../src/cli/format'
import type { MeterQuery } from '../src/runtime/queries'
import type { MeterSnapshot } from '../src/runtime/snapshot'

const pool = (key = 'pool') => {
  const used = event<{ amount: number }>(`${key}.used`)
  const usage = meter(key, { reducer: sum(used, 'amount'), price: usd(12) })
  return plugin('pool', {
    schema: { used, usage },
    runtime: ({ meters }): MeterQuery => meters.usage,
    snapshot: (meters): MeterSnapshot => meters.usage,
  })
}

const wallet = pool()
const pro = product('pro', {
  name: 'Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [wallet.usage],
})
const config = defineConfig({ schema: { wallet, pro } })

it('a plugin deploys its definitions as if the schema exported them', () => {
  assert.deepEqual(
    config.events.map((e) => e.name),
    ['pool.used'],
  )
  assert.deepEqual(
    config.reducers.map((r) => r.key),
    ['pool'],
  )
  assert.deepEqual(
    config.meters.map((m) => m.key),
    ['pool'],
  )
  assert.deepEqual(
    config.plugins.map((p) => p.name),
    ['pool'],
  )
  const ir = compile(config)
  assert.deepEqual(ir.meters, [
    { slug: 'pool', reducer: 'pool', unit_amount: 12, currency: 'usd' },
  ])
  assert.deepEqual(ir.reducers[0]?.aggregation, {
    func: 'sum',
    property: 'amount',
  })
  // A bare plugin meter on a product is pay per use, like any bare meter.
  assert.deepEqual(ir.products[0]?.meters, [
    { slug: 'pool', included: 0, limit: 'soft', rollover_cap: 0 },
  ])
  // The IR knows nothing of plugins: the same definitions by hand hash the same.
  const used = event<{ amount: number }>('pool.used')
  const usage = meter('pool', {
    reducer: sum(used, 'amount'),
    price: usd(12),
  })
  const byHand = defineConfig({
    schema: {
      usage,
      pro: product('pro', {
        name: 'Pro',
        price: recurring({ interval: 'month', amount: usd(49) }),
        meters: [usage],
      }),
    },
  })
  assert.deepEqual(compile(byHand), ir)
})

it('two instances need distinct keys, and a plugin cannot shadow the scope', () => {
  expect(() =>
    defineConfig({
      schema: { a: pool(), b: pool() },
    }),
  ).toThrow('meter pool is defined twice')
  const two = defineConfig({
    schema: {
      staff: pool(),
      guests: pool('guest-pool'),
    },
  })
  assert.deepEqual(
    two.meters.map((m) => m.key),
    ['pool', 'guest-pool'],
  )
  assert.deepEqual(
    two.events.map((e) => e.name),
    ['pool.used', 'guest-pool.used'],
  )
  expect(() => defineConfig({ schema: { meters: pool() } })).toThrow(
    'plugin pool exported as meters: that name belongs to the scope',
  )
})

it('a plugin with an unkeyed reducer is rejected like a bare export', () => {
  const hit = event('hit')
  const broken = plugin('broken', {
    schema: { hits: sum(hit, 'x' as never) },
    runtime: () => ({}),
  })
  expect(() => defineConfig({ schema: { broken } })).toThrow(
    'reducer exported as broken.hits has no key',
  )
})

it('plugin origins cover the meter, its reducer and the server-made credit reducer', async () => {
  const { pluginOrigins } = await import('../src/cli/index')
  assert.deepEqual(
    [...pluginOrigins(config)],
    [
      ['pool.used', 'pool'],
      ['pool', 'pool'],
      ['pool-credits', 'pool'],
    ],
  )
})

it('plan output attributes plugin entries to their plugin', () => {
  const text = describePlan(
    [
      {
        reason: null,
        id: null,
        price_preview: null,
        kind: 'meter',
        key: 'pool',
        action: 'create',
      },
      {
        id: null,
        price_preview: null,
        kind: 'reducer',
        key: 'pool',
        action: 'create',
        reason: 'new',
      },
      {
        reason: null,
        id: null,
        price_preview: null,
        kind: 'product',
        key: 'pro',
        action: 'create',
      },
    ],
    false,
    new Map([['pool', 'pool']]),
  )
  const lines = text.split('\n')
  assert.ok(lines[0]?.endsWith('via pool'), lines[0])
  assert.ok(lines[1]?.endsWith('new  via pool'), lines[1])
  assert.ok(!lines[2]?.includes('via'), lines[2])
})
