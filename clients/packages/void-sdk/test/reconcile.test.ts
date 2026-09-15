import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import {
  createVoid,
  defineConfig,
  event,
  meter,
  sum,
  max,
  map,
  min,
  count,
  on,
  like,
  not,
  gt,
  type Wire,
} from '../src/index'
import { reconcile, decide } from '../src/storage/reconcile'
import { persistSQLiteEvents } from '../src/storage/sqlite'
import type { StoredEvent } from '../src/storage/storage'
import { matches } from '../src/storage/reducers'
import { compile } from '../src/config/compile'

const at = '2026-09-07T12:04:00.000Z'
const start = '2026-09-07T12:00:00.000Z'
const use = event<{ amount: number }>('use')
const buy = event<{ amount: number }>('buy')
const spent = sum('spent', use, 'amount')
const purchased = sum('purchased', buy, 'amount')
const credits = meter('credits', {
  reducer: spent,
  creditReducer: purchased,
  price: { amount: 0 },
})
const config = defineConfig({ schema: { use, buy, spent, purchased, credits } })
const local = (
  id: string,
  name = 'use',
  amount = 10,
  actor = 'root',
  timestamp = at,
): StoredEvent => ({
  organization_id: 'org',
  external_id: id,
  external_identity_id: actor,
  timestamp,
  name,
  metadata: { amount },
  recorded_at: at,
})
const receipt = (event_ids: string[]): Wire.ProcessedEvent => ({
  external_id: event_ids.at(-1) ?? 'remote',
  timestamp: at,
  ingested_at: at,
  event_ids,
})
const bucket = (
  reducer_id: string,
  value: number,
  event_ids: string[] = [],
  actor = 'root',
): Wire.ReducerState => ({
  reducer_id,
  value,
  external_identity_id: actor,
  bucket_start: start,
  last_processed_event: receipt(event_ids),
})
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
type Fixture = Mutable<Omit<Wire.CustomerState, 'meters'>> & {
  meters: (Omit<Mutable<Wire.CustomerMeterState>, 'holders'> & {
    holders: Mutable<Wire.MeterHolderState>[]
  })[]
}
function snapshot(): Fixture {
  return {
    organization_id: 'org',
    at,
    since: '1970-01-01T00:00:00.000Z',
    customer: {
      id: 'customer',
      external_id: 'root',
      email: 'a@example.com',
      name: 'A',
      created_at: at,
    },
    identities: [{ external_id: 'root', parent_external_id: null }],
    reducers: compile(config).reducers.map((r) => ({
      ...r,
      filter: r.filter ?? null,
      map: r.map ?? null,
      id: r.slug,
      created_at: at,
      type: 'scalar' as const,
    })),
    meters: [
      {
        usage_last_processed_event: receipt(['processed']),
        credit_last_processed_event: receipt(['purchase']),
        meter: {
          id: 'meter',
          slug: 'credits',
          name: 'Credits',
          generation_id: 1,
          usage_reducer_id: 'spent',
          credit_reducer_id: 'purchased',
          unit_amount: '0',
          created_at: at,
        },
        holders: [
          {
            external_identity_id: 'root',
            balance: { credits: 100, usage: 20, remaining: 80, overage: 0 },
            base: { at: '1970-01-01T00:00:00.000Z', remaining: 0, overage: 0 },
            is_holder: true,
            events: [],
          },
        ],
      },
    ],
    buckets: [
      bucket('purchased', 100, ['purchase']),
      bucket('spent', 20, ['processed']),
    ],
  }
}
const check = (s = snapshot(), events: StoredEvent[] = []) =>
  reconcile(config, credits, s, 'root', events, new Date(at))
const balance = (s = snapshot(), events: StoredEvent[] = [], id = 'root') =>
  reconcile(config, credits, s, id, events, new Date(at), 'balance')

it.each([undefined, 'candidate'])(
  'reconciles only the configured variant: %s',
  (variantId) => {
    const s = snapshot()
    const selected = s.meters[0]!
    selected.meter = { ...selected.meter, variant_id: variantId }
    s.meters.unshift({
      ...selected,
      meter: {
        ...selected.meter,
        id: 'other-variant',
        variant_id: variantId === undefined ? 'candidate' : null,
        generation_id: 99,
        usage_reducer_id: 'other-usage',
      },
    })
    const scoped = defineConfig({ schema: config.schema, variantId })
    expect(
      reconcile(scoped, credits, s, 'root', [], new Date(at), 'balance'),
    ).toMatchObject({ remaining: 80, overage: 0 })
  },
)

it.each([
  {
    events: [local('processed', 'use', 20)],
    usage: 20,
    credits: 100,
    remaining: 80,
    overage: 0,
    count: 0,
  },
  {
    events: [local('pending', 'use', 100)],
    usage: 120,
    credits: 100,
    remaining: 0,
    overage: 20,
    count: 1,
  },
  {
    events: [local('pending', 'buy', 30)],
    usage: 20,
    credits: 130,
    remaining: 110,
    overage: 0,
    count: 1,
  },
  {
    events: [local('pending', 'buy', -90)],
    usage: 20,
    credits: 10,
    remaining: 0,
    overage: 10,
    count: 1,
  },
  {
    events: [local('buy', 'buy', 10), local('use', 'use', 10)],
    usage: 30,
    credits: 110,
    remaining: 80,
    overage: 0,
    count: 2,
  },
])(
  'reconciles balance and overage without an estimate: $remaining/$overage',
  ({ events, usage, credits: held, remaining, overage, count }) => {
    expect(balance(snapshot(), events)).toEqual({
      usage,
      credits: held,
      remaining,
      overage,
      limit: 'hard',
      limitedBy: 'root',
      reason: 'ok',
      period: null,
      reconciliation: {
        applied: count > 0,
        eventCount: count,
        remoteRemaining: 80,
        localAdjustment: remaining - 80,
      },
    })
  },
)

it('balance reports own credits and subtree usage with the remaining the chain allows', () => {
  const s = snapshot()
  s.identities = [
    ...s.identities,
    { external_id: 'child', parent_external_id: 'root' },
    { external_id: 'grandchild', parent_external_id: 'child' },
  ]
  s.meters[0].holders.push({
    external_identity_id: 'child',
    balance: { credits: 200, usage: 0, remaining: 200, overage: 0 },
    base: { at: '1970-01-01T00:00:00.000Z', remaining: 0, overage: 0 },
    is_holder: true,
    events: [],
  })
  s.buckets = [
    ...s.buckets,
    bucket('purchased', 200, ['child-purchase'], 'child'),
  ]
  const events = [
    local('child-use', 'use', 10, 'grandchild'),
    local('root-buy', 'buy', 5),
  ]
  // The child holds 200 of its own, but the root's 100 minus everyone's
  // usage is the tighter limit, and that is what the child may still spend.
  expect(balance(s, events, 'child')).toEqual({
    usage: 10,
    credits: 200,
    remaining: 75,
    overage: 0,
    limit: 'hard',
    limitedBy: 'root',
    reason: 'ok',
    period: null,
    reconciliation: {
      applied: true,
      eventCount: 2,
      remoteRemaining: 80,
      localAdjustment: -5,
    },
  })
  expect(
    reconcile(config, credits, s, 'child', events, new Date(at)).remaining,
  ).toBe(75)
})

it('balance returns zero without a holder and still reports own usage', () => {
  const s = snapshot()
  s.buckets = []
  s.meters[0].holders[0].balance = {
    credits: 0,
    usage: 0,
    remaining: 0,
    overage: 0,
  }
  s.meters[0].holders[0].is_holder = false
  expect(balance(s)).toMatchObject({ remaining: 0, reason: 'no_plan' })
  expect(balance(s, [local('usage', 'use', 7)])).toMatchObject({
    usage: 7,
    remaining: 0,
    overage: 0,
    reason: 'no_plan',
  })
})

it.each([null, 'c'.repeat(64)])(
  'balance follows default variant %s for SQLite, remote, and historical reads',
  async (variantId) => {
    const scopedSnapshot = () => {
      const state = snapshot()
      state.meters[0].meter = {
        ...state.meters[0].meter,
        variant_id: variantId,
      }
      return state
    }
    const db = new DatabaseSync(':memory:')
    persistSQLiteEvents(db, 'org', [
      local('processed', 'use', 20),
      local('new-use', 'use', 10),
      local('new-credit', 'buy', 30),
    ])
    db.exec('PRAGMA query_only = ON')
    const requests: URL[] = []
    let unavailable = false
    const client = createVoid(
      defineConfig({
        schema: config.schema,
        eventStorage: [{ type: 'sqlite', connection: db }],
      }),
      {
        apiUrl: 'http://void',
        token: 'token',
        fetch: async (input, init) => {
          const request = new Request(input, init)
          expect(request.method).toBe('GET')
          const url = new URL(request.url)
          requests.push(url)
          if (url.pathname === '/v1/void/organizations/current')
            return Response.json({
              id: 'org',
              name: 'Org',
              slug: 'org',
              created_at: at,
              default_variant_id: variantId,
            })
          if (url.pathname === '/v1/void/identities/root')
            return Response.json({
              id: 'root',
              external_id: 'root',
              parent_external_id: null,
              metadata: {},
              created_at: at,
              chain: ['root'],
              children: [],
            })
          if (url.pathname === '/v1/void/customers/root/state') {
            expect(url.searchParams.get('variant_id')).toBe(variantId ?? '')
            if (unavailable)
              return Response.json(
                { error: 'Unavailable', detail: 'down' },
                { status: 503 },
              )
            return Response.json(scopedSnapshot())
          }
          if (url.pathname === '/v1/void/meters')
            return Response.json([scopedSnapshot().meters[0].meter])
          if (url.pathname === '/v1/void/meters/meter/balance')
            return Response.json({
              ...scopedSnapshot().meters[0].holders[0].balance,
              meter_id: 'meter',
              external_identity_id: 'root',
            })
          throw new Error(`Unexpected request ${url.pathname}`)
        },
      },
    )
    try {
      const meter = client.as('root').meters.credits
      expect(await meter.balance()).toEqual({
        usage: 30,
        credits: 130,
        remaining: 100,
        overage: 0,
        limit: 'hard',
        limitedBy: 'root',
        reason: 'ok',
        period: null,
        reconciliation: {
          applied: true,
          eventCount: 2,
          remoteRemaining: 80,
          localAdjustment: 20,
        },
      })
      const remote = {
        usage: 20,
        credits: 100,
        remaining: 80,
        overage: 0,
        limit: null,
        limitedBy: null,
        reason: 'ok',
        period: null,
      }
      expect(await meter.balance({ reconcile: false })).toEqual(remote)
      expect(requests.at(-1)?.pathname).toBe('/v1/void/meters/meter/balance')
      for (const options of [new Date(at), { at: new Date(at) }]) {
        expect(await meter.balance(options)).toEqual(remote)
        expect(requests.at(-1)?.searchParams.get('at')).toBe(at)
      }
      const count = requests.length
      await expect(
        meter.balance({ at: new Date(at), reconcile: true }),
      ).rejects.toMatchObject({ reason: 'invalid_argument' })
      expect(requests).toHaveLength(count)
      unavailable = true
      await expect(meter.balance()).rejects.toMatchObject({ status: 503 })
      expect(requests.at(-1)?.pathname).toBe('/v1/void/customers/root/state')
    } finally {
      await client.dispose()
      db.close()
    }
  },
)
it('merges pending purchases and usage without counting processed events twice', () => {
  expect(
    check(snapshot(), [
      local('processed', 'use', 20),
      local('pending'),
      local('new-credit', 'buy', 50),
    ]).remaining,
  ).toBe(120)
})
it('handles equal timestamps, late events, duplicate copies and independent reducer progress', () => {
  const s = snapshot()
  const pending = local('late', 'use', 15, 'root', '2026-09-06T12:00:00Z')
  expect(
    check(s, [
      local('processed'),
      pending,
      pending,
      local('purchase', 'buy', 100),
    ]).remaining,
  ).toBe(65)
  s.buckets = [
    ...s.buckets,
    { ...bucket('spent', 15, ['late']), bucket_start: '2026-09-06T12:00:00Z' },
  ]
  expect(check(s, [pending]).remaining).toBe(65)
})
it('isolates organizations, identities, future events and unrelated names', () => {
  expect(
    check(snapshot(), [
      { ...local('other-org'), organization_id: 'other' },
      local('other-actor', 'use', 100, 'elsewhere'),
      local('future', 'use', 100, 'root', '2027-01-01T00:00:00Z'),
      local('unrelated', 'other'),
    ]).remaining,
  ).toBe(80)
})
it('fails explicitly for overlapping legacy buckets and mismatched config', () => {
  const s = snapshot()
  s.buckets = [
    { ...bucket('spent', 20), last_processed_event: null },
    bucket('purchased', 100),
  ]
  expect(() => check(s, [local('new')])).toThrow(
    'has no last_processed_event metadata',
  )
  const mismatch = snapshot()
  mismatch.reducers = mismatch.reducers.map((r) =>
    r.id === 'spent' ? { ...r, aggregation: { func: 'count' } } : r,
  )
  expect(() => check(mismatch)).toThrow('differs from local config')
})
it('pending credits establish a holder and existing overage is preserved', () => {
  const s = snapshot()
  s.buckets = []
  s.meters[0].holders[0].is_holder = false
  expect(check(s).reason).toBe('no_plan')
  expect(check(s, [local('credit', 'buy', 10)]).remaining).toBe(10)
  s.buckets = [bucket('purchased', 10), bucket('spent', 30)]
  expect(check(s, [local('credit', 'buy', 15)]).remaining).toBe(0)
})
it('checks every holder and counts sibling usage against shared ancestor credits', () => {
  const s = snapshot()
  s.identities = [
    ...s.identities,
    { external_id: 'child', parent_external_id: 'root' },
    { external_id: 'sibling', parent_external_id: 'root' },
  ]
  s.meters[0].holders = [
    ...s.meters[0].holders,
    {
      external_identity_id: 'child',
      balance: { remaining: 50, overage: 0 },
      base: { at: '1970-01-01T00:00:00.000Z', remaining: 0, overage: 0 },
      is_holder: true,
      events: [],
    },
  ]
  s.buckets = [...s.buckets, bucket('purchased', 50, [], 'child')]
  const result = reconcile(
    config,
    credits,
    s,
    'child',
    [
      local('sibling-use', 'use', 60, 'sibling'),
      local('child-use', 'use', 10, 'child'),
    ],
    new Date(at),
  )
  expect(result).toMatchObject({ remaining: 10, limitedBy: 'root' })
})
it.each(['min', 'max', 'count'] as const)(
  'merges %s using the configured operation',
  (func) => {
    const reducer =
      func === 'min'
        ? min('spent', use, 'amount')
        : func === 'max'
          ? max('spent', use, 'amount')
          : count('spent', use)
    const m = meter('credits', {
      reducer,
      creditReducer: purchased,
      price: { amount: 0 },
    })
    const c = defineConfig({ schema: { reducer, purchased, credits: m } })
    const s = snapshot()
    s.reducers = s.reducers.map((r) =>
      r.id === 'spent' ? { ...r, aggregation: reducer.aggregation } : r,
    )
    const result = reconcile(
      c,
      m,
      s,
      'root',
      [local('new', 'use', 30)],
      new Date(at),
    )
    expect(result.remaining).toBe(
      func === 'min' ? 80 : func === 'max' ? 70 : 79,
    )
  },
)
it('matches server filter semantics for case-insensitive substrings, comparisons and missing properties', () => {
  const e = event<{ label: string; amount: number; missing: string }>('use')
  const reducer = sum(
    'filtered',
    on(e, { label: like('YES'), amount: gt(2), missing: not('present') }),
    'amount',
  )
  const filter = compile(defineConfig({ schema: { reducer } })).reducers[0]
    .filter
  expect(
    matches(
      filter,
      { ...local('one'), metadata: { label: 'yes please', amount: 3 } },
      'root',
    ),
  ).toBe(true)
  expect(
    matches(
      filter,
      { ...local('one'), metadata: { label: 'no', amount: 3 } },
      'root',
    ),
  ).toBe(false)
})

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanups.splice(0)) await close()
})
it('the public check reads SQLite, applies the estimate and never calls the remote check', async () => {
  const db = new DatabaseSync(':memory:')
  persistSQLiteEvents(db, 'org', [local('pending', 'use', 50)])
  const paths: string[] = []
  const client = createVoid(
    defineConfig({
      schema: config.schema,
      eventStorage: [{ type: 'sqlite', connection: db }],
    }),
    {
      apiUrl: 'http://void',
      token: 'token',
      fetch: async (input, init) => {
        const path = new URL(new Request(input, init).url).pathname
        paths.push(path)
        if (path === '/v1/void/organizations/current')
          return Response.json({
            id: 'org',
            name: 'Org',
            slug: 'org',
            created_at: at,
            default_variant_id: null,
          })
        if (path === '/v1/void/identities/root')
          return Response.json({
            id: 'root',
            external_id: 'root',
            parent_external_id: null,
            metadata: {},
            created_at: at,
            chain: ['root'],
            children: [],
          })
        if (path === '/v1/void/customers/root/state')
          return Response.json(snapshot())
        throw Error(`Unexpected request ${path}`)
      },
    },
  )
  cleanups.push(async () => {
    await client.dispose()
    db.close()
  })
  expect(
    await client.as('root').meters.credits.check({ estimate: 50 }),
  ).toMatchObject({ allowed: false, remaining: 30, reason: 'cap' })
  expect(paths).toEqual([
    '/v1/void/organizations/current',
    '/v1/void/identities/root',
    '/v1/void/customers/root/state',
    '/v1/void/customers/root/state',
  ])
})

it('merges a bounded tail with remote summary values instead of replaying settled buckets', () => {
  const s = snapshot()
  s.since = start
  s.buckets = [bucket('spent', 5, ['tail-processed'])]
  s.meters[0].holders[0].credit_base = 100
  s.meters[0].holders[0].usage_base = 20
  expect(check(s, [local('pending', 'use', 10)]).remaining).toBe(65)
})

it.each(['min', 'max'] as const)(
  'preserves %s across the remote summary and replay window',
  (func) => {
    const reducer =
      func === 'min' ? min('spent', use, 'amount') : max('spent', use, 'amount')
    const m = meter('credits', {
      reducer,
      creditReducer: purchased,
      price: { amount: 0 },
    })
    const c = defineConfig({ schema: { reducer, purchased, credits: m } })
    const s = snapshot()
    s.since = start
    s.buckets = []
    s.reducers = s.reducers.map((r) =>
      r.id === 'spent' ? { ...r, aggregation: reducer.aggregation } : r,
    )
    s.meters[0].holders[0].credit_base = 100
    s.meters[0].holders[0].usage_base = 20
    expect(
      reconcile(c, m, s, 'root', [local('pending', 'use', 30)], new Date(at))
        .remaining,
    ).toBe(func === 'min' ? 80 : 70)
  },
)

it.each(['check', 'balance'] as const)(
  '%s uses remote progress across clients without local bookkeeping',
  async (operation) => {
    const db = new DatabaseSync(':memory:')
    persistSQLiteEvents(db, 'org', [local('processed', 'use', 20)])
    const windows: (string | null)[] = []
    let processedAt = at
    const make = () =>
      createVoid(
        defineConfig({
          schema: config.schema,
          eventStorage: [{ type: 'sqlite', connection: db }],
        }),
        {
          apiUrl: 'http://void',
          token: 'token',
          fetch: async (input, init) => {
            const url = new URL(new Request(input, init).url)
            if (url.pathname === '/v1/void/organizations/current')
              return Response.json({
                id: 'org',
                name: 'Org',
                slug: 'org',
                created_at: at,
                default_variant_id: null,
              })
            if (url.pathname === '/v1/void/identities/root')
              return Response.json({
                id: 'root',
                external_id: 'root',
                parent_external_id: null,
                metadata: {},
                created_at: at,
                chain: ['root'],
                children: [],
              })
            if (url.pathname === '/v1/void/customers/root/state') {
              const since = url.searchParams.get('since')
              windows.push(since)
              const state = snapshot()
              state.meters[0].usage_last_processed_event = {
                ...receipt(['processed']),
                timestamp: processedAt,
              }
              state.meters[0].credit_last_processed_event = receipt([
                'purchase',
              ])
              if (!since) {
                state.since = state.at
                state.buckets = []
                state.meters[0].holders[0].base = {
                  ...state.meters[0].holders[0].balance,
                  at: state.at,
                }
              } else state.since = since
              return Response.json(state)
            }
            throw Error(`Unexpected request ${url.pathname}`)
          },
        },
      )
    db.exec('PRAGMA query_only = ON')
    const first = make()
    try {
      expect(
        (
          await (operation === 'check'
            ? first.as('root').meters.credits.check({ estimate: 50 })
            : first.as('root').meters.credits.balance())
        ).remaining,
      ).toBe(80)
    } finally {
      await first.dispose()
    }
    expect(windows).toHaveLength(2)
    expect(windows[1]).toBe('2026-09-07T11:55:00.000Z')
    // A newer event timestamp cannot prove that an older event was included.
    processedAt = '2026-09-07T12:05:00.000Z'
    db.exec('PRAGMA query_only = ON')
    const second = make()
    try {
      windows.length = 0
      expect(
        (
          await (operation === 'check'
            ? second.as('root').meters.credits.check({ estimate: 50 })
            : second.as('root').meters.credits.balance())
        ).remaining,
      ).toBe(80)
      expect(windows).toEqual([null, '2026-09-07T11:55:00.000Z'])
      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(),
      ).toEqual([
        { name: 'polar_void_events' },
        { name: 'polar_void_rejected_events' },
      ])
    } finally {
      await second.dispose()
      db.close()
    }
  },
)

it('reports only unprocessed local events and separates remote availability from their adjustment', () => {
  const s = snapshot()
  expect(check(s, [local('processed', 'use', 20)]).reconciliation).toEqual({
    applied: false,
    eventCount: 0,
    remoteRemaining: 80,
    localAdjustment: 0,
  })
  expect(
    check(s, [local('pending', 'use', 50), local('pending', 'use', 50)])
      .reconciliation,
  ).toEqual({
    applied: true,
    eventCount: 1,
    remoteRemaining: 80,
    localAdjustment: -50,
  })
  expect(check(s, [local('pending-credit', 'buy', 10)]).reconciliation).toEqual(
    {
      applied: true,
      eventCount: 1,
      remoteRemaining: 80,
      localAdjustment: 10,
    },
  )
  expect(
    check(s, [
      local('pending-credit', 'buy', 10),
      local('pending-use', 'use', 10),
    ]).reconciliation,
  ).toEqual({
    applied: true,
    eventCount: 2,
    remoteRemaining: 80,
    localAdjustment: 0,
  })
  s.buckets = [
    bucket('purchased', 100, ['purchase']),
    bucket('spent', 70, ['processed', 'pending']),
  ]
  s.meters[0].holders[0].balance = {
    credits: 100,
    usage: 70,
    remaining: 30,
    overage: 0,
  }
  expect(check(s, [local('pending', 'use', 50)]).reconciliation).toEqual({
    applied: false,
    eventCount: 0,
    remoteRemaining: 30,
    localAdjustment: 0,
  })
})

it('reconciles mapped pending usage and rejects a different deployed map', () => {
  const mappedSpent = sum(
    'spent',
    map(use, { amount: '$amount + 20' }),
    'amount',
  )
  const mappedCredits = meter('credits', {
    reducer: mappedSpent,
    creditReducer: purchased,
    price: { amount: 0 },
  })
  const mappedConfig = defineConfig({
    schema: { use, buy, purchased, mappedCredits },
  })
  const state = snapshot()
  state.reducers = state.reducers.map((r) =>
    r.id === 'spent' ? { ...r, map: { amount: '$amount + 20' } } : r,
  )
  const result = reconcile(
    mappedConfig,
    mappedCredits,
    state,
    'root',
    [local('mapped')],
    new Date(at),
    'balance',
  )
  expect(result.remaining).toBe(50)
  expect(() =>
    reconcile(config, credits, state, 'root', [], new Date(at)),
  ).toThrow('differs from local config')
})

function cappedSnapshot(cap = 40) {
  const s = snapshot()
  s.identities = [
    { external_id: 'root', parent_external_id: null },
    {
      external_id: 'child',
      parent_external_id: 'root',
      entitlements: { meters: [{ meter: 'credits', cap }] },
    },
  ]
  s.meters[0]!.holders[0]!.events = [
    {
      id: 'subscription',
      name: 'subscription.created',
      at: '2026-09-01T00:00:00.000Z',
      data: { meter_interval: 'month', included: 1000, rollover_cap: 0 },
    },
  ]
  s.meters[0]!.holders.push({
    external_identity_id: 'child',
    balance: { usage: 35, remaining: 0, overage: 35 },
    base: { remaining: 0, overage: 0 },
    is_holder: false,
    events: [],
    entitlement: {
      external_identity_id: 'child',
      cap,
      usage: 35,
      remaining: Math.max(cap - 35, 0),
      period_start: '2026-09-01T00:00:00.000Z',
      period_end: '2026-10-01T00:00:00.000Z',
    },
    entitlement_usage_base: 0,
  })
  s.buckets = [...s.buckets, bucket('spent', 35, ['child-processed'], 'child')]
  return s
}

it('applies child entitlements to the existing reconciled reducer buckets', () => {
  const s = cappedSnapshot()
  const result = decide(
    reconcile(
      config,
      credits,
      s,
      'child',
      [
        local('child-processed', 'use', 35, 'child'),
        local('child-pending', 'use', 6, 'child'),
      ],
      new Date(at),
    ),
    1,
  )
  expect(result).toMatchObject({
    allowed: false,
    remaining: 0,
    limitedBy: 'child',
    reason: 'cap',
  })
  expect(result.reconciliation).toMatchObject({
    eventCount: 1,
    remoteRemaining: 5,
  })
})

it('keeps child caps unchanged when pending root credits top up the shared balance', () => {
  const s = cappedSnapshot()
  const result = decide(
    reconcile(
      config,
      credits,
      s,
      'child',
      [local('top-up', 'buy', 500)],
      new Date(at),
    ),
    6,
  )
  expect(result).toMatchObject({
    allowed: false,
    remaining: 5,
    limitedBy: 'child',
    reason: 'cap',
  })
})

it('counts sibling usage against the ancestor entitlement but not the child cap', () => {
  const s = cappedSnapshot(100)
  s.identities = [
    ...s.identities,
    { external_id: 'sibling', parent_external_id: 'root' },
  ]
  s.meters[0]!.holders[0]!.entitlement = {
    external_identity_id: 'root',
    cap: 60,
    usage: 55,
    remaining: 5,
    period_start: '2026-09-01T00:00:00.000Z',
    period_end: '2026-10-01T00:00:00.000Z',
  }
  const result = decide(
    reconcile(
      config,
      credits,
      s,
      'child',
      [local('sibling-use', 'use', 4, 'sibling')],
      new Date(at),
    ),
    2,
  )
  expect(result).toMatchObject({
    allowed: false,
    remaining: 1,
    limitedBy: 'root',
    reason: 'cap',
  })
})

it('resets measured cap usage through the existing root fold at the next cycle', () => {
  const s = cappedSnapshot()
  const result = decide(
    reconcile(
      config,
      credits,
      s,
      'child',
      [local('next-month', 'use', 2, 'child', '2026-10-01T01:00:00.000Z')],
      new Date('2026-10-02T00:00:00.000Z'),
    ),
    38,
  )
  expect(result).toMatchObject({
    allowed: true,
    remaining: 38,
    limitedBy: 'child',
  })
  expect(result.period?.start.toISOString()).toBe('2026-10-01T00:00:00.000Z')
})

it('uses the compact entitlement baseline once when replaying a pending tail', () => {
  const s = cappedSnapshot()
  s.since = start
  s.meters[0]!.holders[1]!.entitlement_usage_base = 20
  s.buckets = s.buckets.filter((b) => b.external_identity_id !== 'child')
  s.buckets = [...s.buckets, bucket('spent', 15, ['tail-processed'], 'child')]
  const result = decide(
    reconcile(
      config,
      credits,
      s,
      'child',
      [
        local('tail-processed', 'use', 15, 'child'),
        local('tail-pending', 'use', 3, 'child'),
      ],
      new Date(at),
    ),
    2,
  )
  expect(result).toMatchObject({
    allowed: true,
    remaining: 2,
    limitedBy: 'child',
  })
})

it('denies narrowed meter access before allowing a child to use root credits', () => {
  const s = cappedSnapshot()
  s.identities = s.identities.map((node) =>
    node.external_id === 'root'
      ? { ...node, entitlements: { meters: [] } }
      : node,
  )
  const result = decide(
    reconcile(config, credits, s, 'child', [], new Date(at)),
    1,
  )
  expect(result).toMatchObject({
    allowed: false,
    limitedBy: 'root',
    reason: 'access_denied',
  })
})

it('reports a missing root period after a pending revocation', () => {
  const s = cappedSnapshot()
  const revoke = {
    ...local('revoked', 'subscription.revoked'),
    metadata: { meter_id: 'meter' },
  }
  const result = decide(
    reconcile(config, credits, s, 'child', [revoke], new Date(at)),
    1,
  )
  expect(result).toMatchObject({
    allowed: false,
    reason: 'missing_period',
    limitedBy: 'child',
  })
})

it.each(['09', '10'])(
  'counts the opening reducer bucket in an unaligned %s cap period',
  (month) => {
    const s = cappedSnapshot()
    const boundary = `2026-${month}-07T12:02:09.857Z`
    const current = `2026-${month}-07T12:04:00.000Z`
    const tail = `2026-${month}-07T12:00:00.000Z`
    s.since = tail
    s.at = current
    s.meters[0]!.holders[0]!.events = [
      {
        id: 'subscription',
        name: 'subscription.created',
        at: '2026-09-07T12:02:09.857Z',
        data: { meter_interval: 'month', included: 1000, rollover_cap: 0 },
      },
    ]
    s.buckets = s.buckets.map((b) => ({ ...b, bucket_start: tail }))
    const result = decide(
      reconcile(
        config,
        credits,
        s,
        'child',
        [local('pending', 'use', 6, 'child', current)],
        new Date(current),
      ),
      1,
    )
    expect(result).toMatchObject({
      allowed: false,
      remaining: 0,
      limitedBy: 'child',
      reason: 'cap',
    })
    expect(result.period?.start.toISOString()).toBe(boundary)
  },
)
