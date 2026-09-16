import { assert, expectTypeOf, it } from '@effect/vitest'
import type { Schema } from 'effect'
import {
  compile,
  createVoid,
  defineConfig,
  included,
  product,
  recurring,
  usd,
} from '../src/index'
import { credits, tags } from '../src/plugins/index'

type Json = Schema.Json

const wallet = credits({
  price: usd(0.01),
  tags: tags<{ reason: string }>(),
})
const pro = product('pro', {
  name: 'Pro',
  price: recurring({ interval: 'month', amount: usd(19) }),
  meters: [included(wallet.credits, 500, { limit: 'hard' })],
})
const config = defineConfig({ schema: { wallet, pro } })

it('owns a spent and a granted event by default and prices overage per credit', () => {
  const ir = compile(config)
  assert.deepEqual(
    ir.events.map((e) => e.name),
    ['credits.granted', 'credits.spent'],
  )
  assert.deepEqual(
    ir.reducers.map((r) => [r.slug, r.aggregation]),
    [
      ['credits', { func: 'sum', property: 'amount' }],
      ['credits-granted', { func: 'sum', property: 'amount' }],
    ],
  )
  assert.deepEqual(ir.meters, [
    {
      slug: 'credits',
      reducer: 'credits',
      credit_reducer: 'credits-granted',
      unit_amount: 0.01,
      currency: 'usd',
    },
  ])
  assert.deepEqual(ir.products[0]?.meters, [
    { slug: 'credits', included: 500, limit: 'hard', rollover_cap: 0 },
  ])
})

const serve = (initial: number) => {
  const posts: Array<{ name: string; metadata: Json }> = []
  let remaining = initial
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status })
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(
      input instanceof Request ? input.url : input,
    )
    const path = pathname.replace(/^\/v1\/void(?=\/|$)/, '')
    const method = init?.method ?? 'GET'
    const raw = init?.body
    const text =
      typeof raw === 'string'
        ? raw
        : raw instanceof Uint8Array
          ? new TextDecoder().decode(raw)
          : undefined
    const body: Json | undefined = text ? JSON.parse(text) : undefined
    if (path === '/reducers')
      return json([
        {
          map: null,

          id: 'r-spent',
          slug: 'credits',
          created_at: 'a',
          type: 'scalar',
          filter: { conjunction: 'and', clauses: [] },
          aggregation: { func: 'sum', property: 'x' },
        },
      ])
    if (path === '/meters')
      return json([
        {
          version_id: 'a'.repeat(64),
          id: 'm-pool',
          name: 'credits',
          slug: 'credits',
          usage_reducer_id: 'r-spent',
          credit_reducer_id: 'r-granted',
          unit_amount: '0',
          currency: 'usd',
          created_at: 'a',
        },
      ])
    if (path === '/meters/m-pool/check') {
      const allowed = remaining >= Number(searchParams.get('size'))
      return json({
        entitlements: [],
        period_start: null,
        period_end: null,

        allowed,
        reason: allowed ? 'ok' : 'exhausted',
        remaining,
        overage: 0,
        limit: 'hard',
        external_identity_id: 'c1',
      })
    }
    if (path === '/meters/m-pool/balance')
      return json({
        credits: 0,
        usage: 0,
        limited_by: null,
        limit: null,
        reason: 'ok',
        period_start: null,
        period_end: null,

        meter_id: 'm-pool',
        external_identity_id: 'c1',
        at: null,
        subscription: null,
        boundary: null,
        boundaries: [],
        cycles: {},
        grants: {},
        expired: {},
        overage: 0,
        remaining,
      })
    if (path === '/events' && method === 'POST') {
      const rows = Array.isArray(body) ? body : []
      for (const row of rows) {
        if (typeof row !== 'object' || row === null || Array.isArray(row))
          continue
        const metadata = row.metadata ?? null
        const m =
          typeof metadata === 'object' &&
          metadata !== null &&
          !Array.isArray(metadata)
            ? metadata
            : {}
        if (row.name === 'credits.granted') remaining += Number(m.amount)
        else remaining -= Number(m.amount)
        posts.push({ name: String(row.name), metadata })
      }
      return json({ saved: rows.length, ignored: 0 }, 202)
    }
    if (path === '/organizations/current')
      return json({
        id: 'org',
        name: 'Org',
        slug: 'org',
        created_at: 'a',
        active_version_id: 'a'.repeat(64),
        active_deployment_id: 'deployment',
        can_activate: true,
      })
    return json({ error: 'ResourceNotFound', detail: path }, 404)
  }
  return { fetch, posts }
}

it('charge checks, runs, then spends what settle reports; a denied charge runs nothing', async () => {
  const server = serve(0)
  const client = createVoid(config, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  })
  const c1 = client.as('c1')

  await c1.wallet.grant(60, { reason: 'starter pack' }, { id: 'pack-1' })
  let ran = 0
  const build = async () => {
    ran += 1
    return { pages: 3 }
  }
  const first = await c1.wallet.charge(50, build, () => ({ reason: 'build' }))
  assert.equal(first.charged, true)
  if (first.charged) {
    assert.equal(first.amount, 50)
    assert.equal(first.result.pages, 3)
  }
  const second = await c1.wallet.charge(10, build, (r) => ({
    reason: 'pages',
    amount: r.pages * 3,
  }))
  assert.equal(second.charged, true)
  if (second.charged) assert.equal(second.amount, 9)
  const third = await c1.wallet.charge(50, build, () => ({ reason: 'build' }))
  assert.equal(third.charged, false)
  if (!third.charged) assert.equal(third.check.reason, 'cap')
  assert.equal(ran, 2)
  assert.equal((await c1.wallet.balance()).remaining, 1)

  assert.deepEqual(server.posts, [
    {
      name: 'credits.granted',
      metadata: { reason: 'starter pack', amount: 60 },
    },
    { name: 'credits.spent', metadata: { reason: 'build', amount: 50 } },
    { name: 'credits.spent', metadata: { reason: 'pages', amount: 9 } },
  ])
  expectTypeOf(c1.wallet.usage).toBeFunction()
  // oxlint-disable-next-line no-constant-condition -- Compile-time assertions must not execute.
  if (false) {
    // @ts-expect-error the declared tags are required on a spend
    c1.wallet.spend(1, {})
  }
  await client.dispose()
})
