import nodeAssert from 'node:assert/strict'
import { type Event as WireEvent } from '../src/api/index'
import { assert, expect, expectTypeOf, it } from '@effect/vitest'
import type { Schema } from 'effect'
import {
  VoidError,
  VoidHttpError,
  count,
  createVoid,
  defineConfig,
  entitlement,
  event,
  meter,
  last,
  on,
  sum,
} from '../src/index'

const aiCall = event<{
  tokens: number
  model: string
  status?: string
}>('ai_call')
const tokens = meter('tokens', {
  reducer: sum(aiCall, 'tokens'),
  price: { amount: 0.000002 },
})
const calls = count('calls', on(aiCall, { status: 'ok' }))
const login = event('login')
const lastLogin = count('logins', login)
const lastCall = last('last_call', aiCall)
const config = defineConfig({
  schema: { aiCall, tokens, calls, login, lastLogin, lastCall },
})

type Json = Schema.Json
type JsonObject = { readonly [key: string]: Json }

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Json
  headers: Record<string, string>
}

const isObject = (value: Json): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const object = (value: Json | undefined): JsonObject =>
  value !== undefined && isObject(value) ? value : {}
const rows = (value: Json | undefined): JsonObject[] =>
  Array.isArray(value) ? value.filter(isObject) : []
const row = (call: Call | undefined, index = 0): JsonObject =>
  object(rows(call?.body)[index])
const present = <T>(value: T | undefined | null, what: string): T => {
  if (value === undefined || value === null) throw new Error(`missing ${what}`)
  return value
}

const serve = () => {
  const calls: Call[] = []
  const history: WireEvent[] = []
  const records: Array<{
    external_identity_id: string
    timestamp: string
    data: JsonObject
  }> = []
  const identities = new Map<string, { parent: string | null }>([
    ['customer_123', { parent: null }],
    ['member_1', { parent: 'customer_123' }],
  ])
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status })
  const error = (status: number, error: string, detail: string) =>
    json({ error, detail }, status)
  const identity = (id: string) => {
    const found = present(identities.get(id), id)
    return {
      id: `uuid-${id}`,
      external_id: id,
      parent_external_id: found.parent,
      metadata: {},
      created_at: 't',
    }
  }
  const reducer = (id: string, slug: string, created_at: string) => ({
    id,
    slug,
    created_at,
    type: 'scalar',
    filter: { conjunction: 'and', clauses: [] },
    aggregation: { func: 'count' },
    map: null,
  })
  const meter = (id: string, usage_reducer_id: string, created_at: string) => ({
    version_id: 'a'.repeat(64),
    id,
    name: 'tokens',
    slug: 'tokens',
    usage_reducer_id,
    credit_reducer_id: 'r-credits',
    unit_amount: '0.5',
    currency: 'usd',
    created_at,
  })
  const customer = (external_id: string) => ({
    id: `uuid-${external_id}`,
    external_id,
    email: `${external_id}@example.com`,
    name: null,
    created_at: 't',
  })
  const balance = {
    reason: 'ok',
    period_start: null,
    period_end: null,

    meter_id: 'm-tokens',
    external_identity_id: 'member_1',
    at: null,
    subscription: null,
    boundary: null,
    boundaries: [],
    cycles: {},
    credits: 0,
    usage: 3,
    overage: 1,
    remaining: 7,
    limited_by: 'customer_123',
    limit: 'hard',
  }
  const chain = (id: string): string[] => {
    const parent = present(identities.get(id), id).parent
    return parent === null ? [id] : [id, ...chain(parent)]
  }
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(
      input instanceof Request ? input.url : input,
    )
    const path = pathname.replace(/^\/v1\/void(?=\/|$)/, '')
    const raw = init?.body
    const text =
      typeof raw === 'string'
        ? raw
        : raw instanceof Uint8Array
          ? new TextDecoder().decode(raw)
          : undefined
    const body: Json | undefined = text ? JSON.parse(text) : undefined
    const method = init?.method ?? 'GET'
    const headers = Object.fromEntries(new Headers(init?.headers).entries())
    calls.push({ method, path, query: searchParams, body, headers })

    if (path === '/organizations/current')
      return json({
        id: 'org',
        name: 'Org',
        slug: 'org',
        created_at: 't',
        active_version_id: 'a'.repeat(64),
        active_deployment_id: 'deployment',
        can_activate: true,
      })
    if (path === '/reducers' && method === 'GET')
      return json([
        reducer('r-tokens', 'tokens', 'b'),
        reducer('r-calls', 'calls', 'a'),
        reducer('r-last-call', 'last_call', 'a'),
      ])
    if (path === '/meters' && method === 'GET')
      return json([meter('m-tokens', 'r-tokens', 'b')])
    if (path === '/meters/m-tokens/check')
      return json(
        searchParams.get('external_identity_id') === 'nobody'
          ? {
              entitlements: [],
              overage: 0,
              period_start: null,
              period_end: null,

              allowed: false,
              reason: 'no_holder',
              remaining: 0,
              limit: null,
              external_identity_id: null,
            }
          : {
              entitlements: [],

              allowed: Number(searchParams.get('size')) <= 100,
              reason:
                Number(searchParams.get('size')) <= 100 ? 'ok' : 'exhausted',
              remaining: 100,
              overage: 0,
              limit: 'hard',
              external_identity_id: 'customer_123',
              period_start: '2026-01-01T00:00:00Z',
              period_end: '2026-02-01T00:00:00Z',
            },
      )
    if (path === '/meters/m-tokens/balance') return json(balance)
    if (path === '/metrics')
      return json({
        reducer_id: 'r',
        interval: 'year',
        series: [
          {
            total: 42,
            periods: [],
            external_identity_id: null,
            external_root_id: null,
          },
        ],
      })
    if (path === '/events' && method === 'GET') {
      const matching = history.filter(
        (event) =>
          (!searchParams.has('name') ||
            event.name === searchParams.get('name')) &&
          (!searchParams.has('external_identity_id') ||
            event.external_identity_id ===
              searchParams.get('external_identity_id')),
      )
      return json({
        items: matching.slice(0, Number(searchParams.get('limit') ?? 25)),
        pagination: { total_count: matching.length },
      })
    }
    if (path === '/reducers/r-last-call/records') return json(records)
    if (path === '/events' && method === 'POST') {
      const events = rows(body)
      for (const e of events) {
        const target = e.external_identity_id
        if (typeof target === 'string' && !identities.has(target))
          return error(422, 'InvalidAttribution', 'Unknown billing identity')
      }
      return json({ saved: events.length, ignored: 0 }, 202)
    }
    if (path === '/identities' && method === 'POST') {
      const create = object(body)
      const externalId = String(create.external_id)
      const parent = create.parent_external_id
      if (identities.has(externalId)) return json(identity(externalId))
      identities.set(externalId, {
        parent: typeof parent === 'string' ? parent : null,
      })
      return json(identity(externalId), 201)
    }
    const snapshot = path.match(/^\/identities\/([^/]+)\/snapshot$/)
    if (snapshot) {
      const id = decodeURIComponent(present(snapshot[1], 'identity id'))
      if (!identities.has(id)) return error(404, 'ResourceNotFound', 'nope')
      const ancestry = chain(id)
      const root = present(ancestry.at(-1), 'root identity')
      return json({
        entitlements: [],

        at: '2026-09-07T08:00:00Z',
        identity: identity(id),
        root: identity(root),
        customer: root === 'customer_123' ? customer('customer_123') : null,
        meters: {
          tokens: {
            ...balance,
            at: '2026-09-07T08:00:00Z',
            external_identity_id: id,
          },
        },
      })
    }
    const detail = path.match(/^\/identities\/([^/]+)$/)
    if (detail) {
      const id = decodeURIComponent(present(detail[1], 'identity id'))
      if (!identities.has(id)) return error(404, 'ResourceNotFound', 'nope')
      return json({
        ...identity(id),
        chain: chain(id),
        children: [...identities]
          .filter(([, v]) => v.parent === id)
          .map(([k]) => identity(k)),
      })
    }
    if (path === '/customers' && method === 'POST') {
      const create = object(body)
      return json({ ...customer(String(create.external_id)), ...create }, 201)
    }
    if (path === '/customers/customer_123')
      return json(customer('customer_123'))
    if (path.startsWith('/customers/'))
      return error(404, 'ResourceNotFound', 'no customer')
    return error(404, 'ResourceNotFound', `unhandled ${method} ${path}`)
  }
  return {
    calls,
    history,
    records,
    identities,
    fetch,
  }
}

const client = (server = serve()) => ({
  server,
  client: createVoid(config, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: server.fetch,
  }),
})

it('record posts one event attributed to the scope with a generated id', async () => {
  const { client: c, server } = client()
  await c.as('member_1').events.aiCall.record({ tokens: 7, model: 'gpt-4' })
  await c
    .as('member_1')
    .events.aiCall.record({ tokens: 1, model: 'x' }, { id: 'evt_1' })
  const member = c.as('member_1')
  // oxlint-disable-next-line no-constant-condition -- Compile-time assertions must not execute.
  if (false) {
    // @ts-expect-error not an event export in the config
    member.events.nope.record({})
    // @ts-expect-error metadata shape is checked
    member.events.aiCall.record({ tokens: 'seven', model: 'gpt-4' })
  }
  const posts = server.calls.filter(
    (call) => call.path === '/events' && call.method === 'POST',
  )
  assert.equal(posts.length, 2)
  const first = row(posts[0])
  assert.equal(first.name, 'ai_call')
  assert.equal(first.external_identity_id, 'member_1')
  assert.match(String(first.external_id), /^[0-9a-f-]{36}$/)
  assert.deepEqual(first.metadata, { tokens: 7, model: 'gpt-4' })
  assert.equal(row(posts[1]).external_id, 'evt_1')
  assert.equal(present(posts[0], 'post').headers['x-void-config'], c.checksum)
})

it('record on an unknown identity surfaces the server error', async () => {
  const { client: c } = client()
  await expect(c.as('ghost').events.login.record({})).rejects.toThrow(
    /InvalidAttribution/,
  )
})

it('check resolves the meter id by name once and derives a reason', async () => {
  const { client: c, server } = client()
  const result = await c.as('member_1').meters.tokens.check({ estimate: 8000 })
  assert.deepEqual(result, {
    allowed: false,
    remaining: 100,
    overage: 0,
    limit: 'hard',
    limitedBy: 'customer_123',
    reason: 'cap',
    period: {
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-02-01T00:00:00Z'),
    },
  })
  const noPlan = await c.as('nobody').meters.tokens.check({ estimate: 1 })
  assert.equal(noPlan.reason, 'no_plan')
  const member = c.as('member_1')
  // oxlint-disable-next-line no-constant-condition -- Compile-time assertions must not execute.
  if (false) {
    // @ts-expect-error reducers are not meters
    member.meters.calls.check({ estimate: 1 })
  }
  await expect(
    c.as('member_1').meters.tokens.check({ estimate: 0 }),
  ).rejects.toThrow(/greater than zero/)
  const checks = server.calls.filter(
    (call) => call.path === '/meters/m-tokens/check',
  )
  const check = present(checks[0], 'check').query
  assert.equal(check.get('size'), '8000')
  assert.equal(check.get('external_identity_id'), 'member_1')
  assert.equal(server.calls.filter((call) => call.path === '/meters').length, 1)
  assert.deepEqual(await member.meters.tokens.check({ estimate: 100 }), {
    allowed: true,
    remaining: 100,
    overage: 0,
    limit: 'hard',
    limitedBy: 'customer_123',
    reason: 'ok',
    period: {
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-02-01T00:00:00Z'),
    },
  })
  assert.equal(
    server.calls.some((call) => call.method !== 'GET'),
    false,
  )
})

it('deployment forwards the configured credit reducer to the server', async () => {
  let body: unknown
  const c = createVoid(config, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: async (_, init) => {
      body = await new Response(init?.body).json()
      return Response.json({
        version_id: 'a'.repeat(64),
        id: null,
        checksum: 'test',
        applied: false,
        has_configuration: false,
        status: null,
        entries: [],
        created_at: 't',
      })
    },
  })
  try {
    await c.api.deploys.create({
      checksum: 'test',
      dry_run: true,
      meters: [
        {
          slug: 'credits',
          reducer: 'spent',
          credit_reducer: 'purchased',
          unit_amount: 0,
        },
      ],
    })
    expect(body).toMatchObject({
      meters: [{ credit_reducer: 'purchased' }],
    })
  } finally {
    await c.dispose()
  }
})

it('usage and total address the deployed reducer', async () => {
  const { client: c, server } = client()
  assert.equal(await c.as('member_1').meters.tokens.total(), 42)
  assert.equal(await c.as('member_1').reducers.calls.total(), 42)
  const metrics = server.calls.filter((call) => call.path === '/metrics')
  const [byTokens, byCalls] = metrics.map((call) => call.query)
  assert.equal(byTokens?.get('reducer_id'), 'r-tokens')
  assert.equal(byTokens?.get('external_identity_id'), 'member_1')
  assert.equal(byCalls?.get('reducer_id'), 'r-calls')
  await c
    .as('customer_123')
    .meters.tokens.usage({ groupBy: 'root', interval: 'day' })
  const grouped = present(
    server.calls.filter((call) => call.path === '/metrics').at(-1),
    'grouped metrics call',
  ).query
  assert.equal(grouped.get('group_by'), 'external_root_id')
  assert.equal(grouped.get('interval'), 'day')
})

it("balance reads own usage with the chain's remaining", async () => {
  const { client: c } = client()
  assert.deepEqual(await c.as('member_1').meters.tokens.balance(), {
    usage: 3,
    credits: 0,
    remaining: 7,
    overage: 1,
    limit: 'hard',
    limitedBy: 'customer_123',
    reason: 'ok',
    period: null,
  })
})

it('snapshot reads typed identity state in one request', async () => {
  const { client: c, server } = client()
  const snapshot = await c.as('member_1').snapshot()
  assert.equal(snapshot.at, '2026-09-07T08:00:00Z')
  assert.equal(snapshot.identity.external_id, 'member_1')
  assert.equal(snapshot.root.external_id, 'customer_123')
  assert.equal(snapshot.customer?.external_id, 'customer_123')
  assert.equal(snapshot.meters.tokens.remaining, 7)
  // oxlint-disable-next-line no-constant-condition -- Compile-time assertions must not execute.
  if (false) {
    // @ts-expect-error reducers are not snapshot meters
    void snapshot.meters.calls.remaining
  }
  assert.equal(
    server.calls.filter((call) => call.path === '/identities/member_1/snapshot')
      .length,
    1,
  )
  assert.equal(
    server.calls.some((call) => call.path === '/meters/m-tokens/balance'),
    false,
  )
  await c.dispose()
})

it('spawn creates a child without issuing credits', async () => {
  const { client: c, server } = client()
  const crawl = await c
    .as('member_1')
    .spawn('crawl_1', { metadata: { name: 'Crawl' } })
  assert.equal(crawl.id, 'crawl_1')
  const create = server.calls.find(
    (call) => call.path === '/identities' && call.method === 'POST',
  )
  assert.deepEqual(create?.body, {
    external_id: 'crawl_1',
    parent_external_id: 'member_1',
    metadata: { name: 'Crawl' },
  })
  assert.equal(
    server.calls.some((call) => call.path === '/events'),
    false,
  )
  const anon = await crawl.spawn()
  assert.match(anon.id, /^crawl_1:[0-9a-f]{8}$/)
  assert.deepEqual(await anon.chain(), [
    anon.id,
    'crawl_1',
    'member_1',
    'customer_123',
  ])
  await c.dispose()
})

it('ensure throws where the parent is named when the server holds another', async () => {
  const { client: c } = client()
  await c.ensure('member_1', { parent: 'customer_123' })
  await expect(
    c.ensure('member_1', { parent: 'other_customer' }),
  ).rejects.toThrow(/already exists under customer_123/)
  await expect(c.ensure('fresh')).rejects.toThrow(/no parent given/)
  await expect(c.root('member_1')).rejects.toThrow(
    /already exists under customer_123/,
  )
  const trial = await c.root('trial_root')
  assert.equal(await trial.parent(), null)
})

it('ambient scope supplies the parent and the current actor', async () => {
  const { client: c, server } = client()
  assert.throws(() => c.current(), /no identity in scope/)
  await c.as('member_1').run(async () => {
    assert.equal(c.current().id, 'member_1')
    const crawl = await c.ensure('crawl_2')
    await new Promise((resolve) => setTimeout(resolve, 1))
    await crawl.events.login.record({})
    await c.current().events.login.record({})
  })
  const create = server.calls.find(
    (call) => call.path === '/identities' && call.method === 'POST',
  )
  assert.equal(object(create?.body).parent_external_id, 'member_1')
  const events = server.calls
    .filter((call) => call.path === '/events')
    .map((call) => row(call).external_identity_id)
  assert.deepEqual(events, ['crawl_2', 'member_1'])
})

it('headers carry the identity across a hop', async () => {
  const { client: c } = client()
  const headers = c.as('crawl_9').headers()
  assert.deepEqual(headers, { 'x-void-identity': 'crawl_9' })
  assert.equal(c.from(headers).id, 'crawl_9')
  assert.equal(c.from(new Headers(headers)).id, 'crawl_9')
  assert.throws(() => c.from({}), /x-void-identity/)
})

it('middleware ensures the seat and runs the handler as it', async () => {
  const { client: c, server } = client()
  const mw = c.middleware<{ user: string; org: string }, unknown>((req) => ({
    identity: req.user,
    parent: req.org,
  }))
  const seen = await new Promise<string>((resolve, reject) =>
    mw({ user: 'seat_7', org: 'customer_123' }, {}, (error) =>
      error ? reject(error) : resolve(c.current().id),
    ),
  )
  assert.equal(seen, 'seat_7')
  assert.equal(server.identities.get('seat_7')?.parent, 'customer_123')
  await new Promise<void>((resolve) =>
    mw({ user: 'seat_7', org: 'wrong' }, {}, (error) => {
      assert.match(String(error), /already exists under customer_123/)
      resolve()
    }),
  )
})

it('organization resources forward snake_case query inputs', async () => {
  const { client: c, server } = client()
  await c.api.identities.get('member_1')
  await c.api.events.list({
    external_root_id: 'customer_123',
    limit: 5,
  })
  const list = present(server.calls[1], 'list call').query
  assert.equal(list.get('external_root_id'), 'customer_123')
  assert.equal(list.get('limit'), '5')
})

it('resource writes forward inputs and preserve metadata keys', async () => {
  const { client: c, server } = client()
  try {
    const customer = await c.api.customers.create({
      external_id: 'customer_456',
      email: 'hello@example.com',
      name: null,
    })
    expectTypeOf(customer.email).toEqualTypeOf<string | null>()
    assert.equal(customer.external_id, 'customer_456')
    assert.deepEqual(server.calls[0]?.body, {
      external_id: 'customer_456',
      email: 'hello@example.com',
      name: null,
    })
    const metadata = {
      externalId: 'user-defined',
      nested_data: { unitAmount: 3 },
    }
    await c.api.identities.ensure({
      external_id: 'seat_8',
      parent_external_id: 'customer_123',
      metadata,
    })
    assert.deepEqual(server.calls[1]?.body, {
      external_id: 'seat_8',
      parent_external_id: 'customer_123',
      metadata,
    })
    const result = await c.api.events.ingest([
      {
        name: 'login',
        external_id: 'evt_1',
        external_identity_id: 'seat_8',
        metadata,
      },
    ])
    assert.equal(result.saved, 1)
    assert.deepEqual(server.calls[2]?.body, [
      {
        name: 'login',
        external_id: 'evt_1',
        external_identity_id: 'seat_8',
        metadata,
      },
    ])
  } finally {
    await c.dispose()
  }
})

it('billing resources preserve query inputs including false and zero', async () => {
  const { client: c, server } = client()
  try {
    await c.api.meters.check('m-tokens', {
      external_identity_id: 'member_1',
      size: 0,
    })
    await c.api.meters.balance('m-tokens', {
      external_identity_id: 'member_1',
      at: '2026-09-01T00:00:00Z',
    })
    await c.api.reducers.records('r-last-call', {
      external_identity_id: 'member_1',
    })
    await c.api.metrics.get({
      reducer_id: 'r-tokens',
      start: '2026-01-01',
      end: '2026-12-31',
      interval: 'year',
      external_identity_id: 'member_1',
      cumulative: false,
    })
    assert.equal(server.calls[0]?.query.get('size'), '0')
    assert.equal(server.calls[1]?.query.get('at'), '2026-09-01T00:00:00Z')
    for (const call of server.calls) {
      assert.equal(call.query.get('external_identity_id'), 'member_1')
      assert.equal(call.query.has('externalIdentityId'), false)
    }
    assert.equal(server.calls[3]?.query.get('reducer_id'), 'r-tokens')
    assert.equal(server.calls[3]?.query.get('cumulative'), 'false')
  } finally {
    await c.dispose()
  }
})

it('scope navigation resolves the tree and returns usable scopes', async () => {
  const { client: c } = client()
  try {
    const member = c.as('member_1')
    assert.deepEqual(await member.chain(), ['member_1', 'customer_123'])
    assert.equal((await member.customer())?.external_id, 'customer_123')
    const parent = await member.parent()
    assert.ok(parent)
    assert.equal(parent.id, 'customer_123')
    assert.equal(await parent.parent(), null)
    const root = await member.root()
    assert.equal(root.id, 'customer_123')
    const children = await root.children()
    assert.deepEqual(
      children.map((child) => child.id),
      ['member_1'],
    )
    const [child] = children
    assert.ok(child)
    await child.events.login.record({})
    await parent.run(() => assert.equal(c.current().id, 'customer_123'))
    const spawned = await child.spawn('nested')
    assert.deepEqual(spawned.headers(), { 'x-void-identity': 'nested' })
    assert.equal((await spawned.parent())?.id, child.id)
    const trial = await c.root('trial_root')
    assert.equal(await trial.customer(), null)
  } finally {
    await c.dispose()
  }
})

it('events filters by name on the server before limiting and infers metadata', async () => {
  const { client: c, server } = client()
  const item: WireEvent = {
    id: 'evt',
    timestamp: '2026-01-01T00:00:00Z',
    name: 'login',
    source: 'user',
    external_id: 'evt',
    external_identity_id: 'member_1',
    external_root_id: 'customer_123',
    metadata: {},
  }
  server.history.push(
    ...Array.from({ length: 101 }, (_, index) => ({
      ...item,
      id: `login-${index}`,
    })),
    { ...item, name: 'ai_call', metadata: { tokens: 3, model: 'x' } },
  )
  try {
    const result = await c.as('member_1').events.aiCall.list({ limit: 1 })
    assert.equal(result.length, 1)
    assert.equal(result[0]?.metadata.tokens, 3)
    expectTypeOf(result[0]!.metadata.tokens).toEqualTypeOf<number>()
    expectTypeOf(result[0]!.metadata.status).toEqualTypeOf<string | undefined>()
    assert.equal(server.calls.at(-1)?.query.get('name'), 'ai_call')
    assert.equal(server.calls.at(-1)?.query.get('limit'), '1')
    assert.equal((await c.as('member_1').events.aiCall.list()).length, 1)
    assert.equal(server.calls.at(-1)?.query.get('limit'), '100')
    assert.deepEqual(await c.as('nobody').events.aiCall.list(), [])
  } finally {
    await c.dispose()
  }
})

it('events and latest return historical metadata without runtime field validation', async () => {
  const { client: c, server } = client()
  try {
    assert.equal(await c.as('member_1').reducers.lastCall.latest(), null)
    const historical: JsonObject[] = [
      { tokens: '3', model: 'x' },
      { tokens: 3 },
      { tokens: 3, model: 'x', status: null },
    ]
    for (const metadata of historical) {
      server.history.splice(0, server.history.length, {
        id: 'evt',
        timestamp: '2026-01-01T00:00:00Z',
        name: 'ai_call',
        source: 'user',
        external_id: 'evt',
        external_identity_id: 'member_1',
        external_root_id: 'customer_123',
        metadata,
      })
      server.records.splice(0, server.records.length, {
        external_identity_id: 'member_1',
        timestamp: '2026-01-01T00:00:00Z',
        data: metadata,
      })
      assert.deepEqual(
        (await c.as('member_1').events.aiCall.list())[0]?.metadata,
        metadata,
      )
      assert.deepEqual(
        (await c.as('member_1').reducers.lastCall.latest())?.data,
        metadata,
      )
    }
    server.records.splice(0, server.records.length, {
      external_identity_id: 'member_1',
      timestamp: '2026-01-01T00:00:00Z',
      data: { tokens: 3, model: 'x', status: 'ok' },
    })
    const result = await c.as('member_1').reducers.lastCall.latest()
    assert.equal(result?.data.tokens, 3)
    expectTypeOf(result!.data.tokens).toEqualTypeOf<number>()
    assert.equal(
      (await c.as('member_1').reducers.lastCall.latest())?.data.status,
      'ok',
    )
  } finally {
    await c.dispose()
  }
})

it('dot queries use export names and expose only operations for each definition', async () => {
  const server = serve()
  const c = createVoid(
    defineConfig({
      schema: {
        purchase: aiCall,
        purchaseAlias: aiCall,
        creditBalance: tokens,
        usage: calls,
        profile: lastCall,
        helper: () => 'ignored',
      },
    }),
    { apiUrl: 'http://void/', token: 't', fetch: server.fetch },
  )
  try {
    const actor = c.as('member_1')
    assert.deepEqual(Object.keys(actor.events), ['purchase', 'purchaseAlias'])
    assert.deepEqual(Object.keys(actor.reducers), ['usage', 'profile'])
    assert.deepEqual(Object.keys(actor.meters), ['creditBalance'])
    assert.deepEqual(Object.keys(actor.meters.creditBalance).sort(), [
      'balance',
      'check',
      'total',
      'usage',
    ])
    assert.deepEqual(Object.keys(actor.reducers.profile), ['latest'])
    assert.deepEqual(Object.keys(actor.reducers.usage), ['total', 'usage'])
    await actor.events.purchase.record({ tokens: 4, model: 'x' })
    await actor.events.purchaseAlias.record({ tokens: 2, model: 'y' })
    assert.equal(row(server.calls[0]).name, 'ai_call')
    assert.equal(row(server.calls[1]).name, 'ai_call')
    assert.equal(await actor.meters.creditBalance.total(), 42)
    assert.equal(await actor.reducers.usage.total(), 42)
    // oxlint-disable-next-line no-constant-condition -- Compile-time assertions must not execute.
    if (false) {
      // @ts-expect-error wire names are not schema export names
      actor.events.ai_call.list()
      // @ts-expect-error helpers do not become queries
      actor.events.helper.list()
      // @ts-expect-error a record reducer has no scalar total
      actor.reducers.profile.total()
      // @ts-expect-error a scalar reducer has no latest record
      actor.reducers.usage.latest()
      // @ts-expect-error metadata retains the declared event shape
      actor.events.purchase.record({ tokens: 'four', model: 'x' })
      // @ts-expect-error subscription setup is not exposed
      actor.meters.creditBalance.subscribe({ interval: 'month' })
      // @ts-expect-error credit grants are not exposed
      actor.meters.creditBalance.grant(100)
      // @ts-expect-error spawn only creates identities
      actor.spawn('child', { caps: { tokens: 100 } })
      // @ts-expect-error old direct Promise verbs are removed
      actor.record(aiCall, { tokens: 1, model: 'x' })
    }
  } finally {
    await c.dispose()
  }
})

it('event reads still validate the HTTP response structure', async () => {
  const c = createVoid(config, {
    apiUrl: 'http://void/',
    token: 't',
    fetch: async () =>
      new Response(
        JSON.stringify({
          items: 'not an array',
          pagination: { total_count: 1 },
        }),
      ),
  })
  try {
    await expect(c.as('member_1').events.aiCall.list()).rejects.toMatchObject({
      _tag: 'MalformedResponse',
    })
  } finally {
    await c.dispose()
  }
})

it('identity context is isolated between clients and restored after nested runs', async () => {
  const { client: a } = client()
  const { client: b, server } = client()
  try {
    await a.as('customer_123').run(async () => {
      nodeAssert.throws(() => b.current(), { reason: 'no_scope' })
      await expect(b.ensure('must_not_inherit')).rejects.toMatchObject({
        reason: 'no_scope',
      })
      assert.equal(server.calls.length, 0)
      await b.as('member_1').run(async () => {
        await Promise.resolve()
        assert.equal(a.current().id, 'customer_123')
        assert.equal(b.current().id, 'member_1')
        await b.ensure('child_of_b')
        await a.as('nested').run(() => assert.equal(a.current().id, 'nested'))
        assert.equal(a.current().id, 'customer_123')
      })
      nodeAssert.throws(() => b.current(), { reason: 'no_scope' })
    })
    assert.equal(server.identities.get('child_of_b')?.parent, 'member_1')
    nodeAssert.throws(() => a.current(), { reason: 'no_scope' })
    await Promise.all(
      ['left', 'right'].map((id) =>
        a.as(id).run(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1))
          assert.equal(a.current().id, id)
        }),
      ),
    )
    await expect(
      a.as('temporary').run(() => {
        throw new Error('handler failed')
      }),
    ).rejects.toThrow('handler failed')
    nodeAssert.throws(() => a.current(), { reason: 'no_scope' })
  } finally {
    await Promise.all([a.dispose(), b.dispose()])
  }
})

it('public errors retain their classes and fields for sync throws and Promise rejections', async () => {
  const { client: c } = client()
  try {
    for (const action of [
      () => c.current(),
      () => c.from({}),
      () => c.from({ 'x-void-identity': '' }),
    ]) {
      nodeAssert.throws(
        action,
        (error: unknown) =>
          error instanceof VoidError && error.reason === 'no_scope',
      )
    }
    await nodeAssert.rejects(
      c.ensure('no_parent'),
      (error: unknown) =>
        error instanceof VoidError && error.reason === 'no_scope',
    )
    await nodeAssert.rejects(
      c.ensure('member_1', { parent: 'wrong' }),
      (error: unknown) =>
        error instanceof VoidError && error.reason === 'parent_mismatch',
    )
    await nodeAssert.rejects(
      c.as('member_1').meters.tokens.check({ estimate: 0 }),
      (error: unknown) =>
        error instanceof VoidError && error.reason === 'invalid_argument',
    )
    await nodeAssert.rejects(
      c.api.customers.get('missing'),
      (error: unknown) =>
        error instanceof VoidHttpError &&
        error.status === 404 &&
        error.notFound,
    )
    await nodeAssert.rejects(
      c.as('missing').tree(),
      (error: unknown) =>
        error instanceof VoidHttpError && error.status === 404,
    )
  } finally {
    await c.dispose()
  }
})

it('middleware forwards resolver failures and keeps other clients out of its context', async () => {
  const { client: a } = client()
  const { client: b } = client()
  const failure = new Error('resolver failed')
  try {
    const failing = a.middleware(() => {
      throw failure
    })
    await new Promise<void>((resolve) =>
      failing({}, {}, (error) => {
        assert.equal(error, failure)
        resolve()
      }),
    )
    const middleware = a.middleware(() => ({
      identity: 'member_1',
      parent: 'customer_123',
    }))
    await new Promise<void>((resolve, reject) =>
      middleware({}, {}, (error) => {
        if (error) return reject(error)
        assert.equal(a.current().id, 'member_1')
        nodeAssert.throws(() => b.current(), { reason: 'no_scope' })
        resolve()
      }),
    )
  } finally {
    await Promise.all([a.dispose(), b.dispose()])
  }
})

it('concurrent middleware handlers retain their identity when recording after await', async () => {
  const { client: c, server } = client()
  const middleware = c.middleware<{ user: string }, unknown>((req) => ({
    identity: req.user,
    parent: 'customer_123',
  }))
  try {
    await Promise.all(
      ['left', 'right'].map(
        (user) =>
          new Promise<void>((resolve, reject) => {
            middleware({ user }, {}, (error) => {
              if (error) return reject(error)
              const handle = async () => {
                await new Promise((resume) => setTimeout(resume, 1))
                assert.equal(c.current().id, user)
                await c
                  .current()
                  .events.aiCall.record({ tokens: 1, model: user })
              }
              void handle().then(resolve, reject)
            })
          }),
      ),
    )
    const posts = server.calls.filter(
      (call) => call.path === '/events' && call.method === 'POST',
    )
    assert.equal(posts.length, 2)
    for (const post of posts) {
      const event = row(post)
      assert.equal(event.external_identity_id, object(event.metadata).model)
    }
    nodeAssert.throws(() => c.current(), { reason: 'no_scope' })
  } finally {
    await c.dispose()
  }
})

it('records typed identity entitlements with a stable retry id', async () => {
  const requests: Request[] = []
  const c = createVoid(config, {
    apiUrl: 'http://void',
    token: 't',
    fetch: async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      return Response.json({
        features: null,
        meters: [{ meter: 'tokens', cap: 100 }],
      })
    },
  })
  await c
    .as('member_1')
    .setEntitlements(
      { meters: [{ meter: tokens, cap: 100 }] },
      { id: 'assignment-1' },
    )
  expect(requests).toHaveLength(1)
  expect(new URL(requests[0]!.url).pathname).toBe(
    '/v1/void/identities/member_1/entitlements',
  )
  expect(requests[0]!.method).toBe('PUT')
  expect(await requests[0]!.json()).toEqual({
    external_id: 'assignment-1',
    features: null,
    meters: [{ meter: 'tokens', cap: 100 }],
  })
})

/** A server that remembers one identity's own terms and echoes writes. */
const entitlementServer = (initial: JsonObject) => {
  let assignment: JsonObject = initial
  const writes: JsonObject[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    if (path === '/v1/void/identities' && request.method === 'POST') {
      const body = object((await request.json()) as Json)
      return Response.json({
        id: 'i',
        external_id: body.external_id,
        parent_external_id: body.parent_external_id ?? null,
        metadata: {},
        created_at: 't',
      })
    }
    if (path.endsWith('/entitlements') && request.method === 'GET') {
      const id = path.split('/').at(-2)!
      return Response.json({
        external_identity_id: id,
        at: 't',
        entitlements: [],
        slugs: [],
        assignments: { [id]: assignment },
      })
    }
    if (path.endsWith('/entitlements') && request.method === 'PUT') {
      const body = object((await request.json()) as Json)
      writes.push(body)
      assignment = { features: body.features, meters: body.meters }
      return Response.json(assignment)
    }
    throw new Error(`unexpected ${request.method} ${path}`)
  }
  return { fetch, writes }
}

it('spawns a child with its starting terms', async () => {
  const server = entitlementServer({ features: null, meters: null })
  const c = createVoid(config, {
    apiUrl: 'http://void',
    token: 't',
    fetch: server.fetch,
  })
  const child = await c.as('customer_123').spawn('member_2', {
    entitlements: { meters: [{ meter: tokens, cap: 50 }] },
  })
  assert.equal(child.id, 'member_2')
  expect(server.writes).toEqual([
    expect.objectContaining({
      features: null,
      meters: [{ meter: 'tokens', cap: 50 }],
    }),
  ])
})

it('cap spells out the inherited meters before capping one', async () => {
  const words = meter('words', {
    reducer: sum(aiCall, 'tokens'),
    price: { amount: 0.000001 },
  })
  const twoMeters = defineConfig({ schema: { aiCall, tokens, words } })
  const server = entitlementServer({ features: null, meters: null })
  const c = createVoid(twoMeters, {
    apiUrl: 'http://void',
    token: 't',
    fetch: server.fetch,
  })
  await c.as('member_1').cap(tokens, 100)
  expect(server.writes[0]).toMatchObject({
    features: null,
    meters: [
      { meter: 'words', cap: null },
      { meter: 'tokens', cap: 100 },
    ],
  })
})

it('cap replaces one entry and keeps the rest', async () => {
  const server = entitlementServer({
    features: ['priority'],
    meters: [
      { meter: 'tokens', cap: 100 },
      { meter: 'calls', cap: 5 },
    ],
  })
  const c = createVoid(config, {
    apiUrl: 'http://void',
    token: 't',
    fetch: server.fetch,
  })
  await c.as('member_1').cap(tokens, null)
  expect(server.writes[0]).toMatchObject({
    features: ['priority'],
    meters: [
      { meter: 'calls', cap: 5 },
      { meter: 'tokens', cap: null },
    ],
  })
})

it('allow and deny edit one feature and leave meters alone', async () => {
  const priority = entitlement('priority')
  const beta = entitlement('beta')
  const withFeatures = defineConfig({
    schema: { aiCall, tokens, priority, beta },
  })
  const server = entitlementServer({
    features: null,
    meters: [{ meter: 'tokens', cap: 1 }],
  })
  const c = createVoid(withFeatures, {
    apiUrl: 'http://void',
    token: 't',
    fetch: server.fetch,
  })
  const member = c.as('member_1')
  await member.allow(priority)
  assert.equal(server.writes.length, 0, 'inherited already; nothing to write')
  await member.deny(beta)
  expect(server.writes[0]).toMatchObject({
    features: ['priority'],
    meters: [{ meter: 'tokens', cap: 1 }],
  })
  await member.allow(beta)
  expect(server.writes[1]).toMatchObject({
    features: ['priority', 'beta'],
    meters: [{ meter: 'tokens', cap: 1 }],
  })
})
