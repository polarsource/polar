import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it, vi } from '@effect/vitest'
import {
  createVoid,
  defineConfig,
  event,
  meter,
  signal,
  sum,
  checksumOf,
  compile,
  type SignalState,
  type Wire,
  type Void,
} from '../src/index'

const use = event<{ amount: number }>('use')
const buy = event<{ amount: number }>('buy')
const credits = meter('credits', {
  reducer: sum('spent', use, 'amount'),
  creditReducer: sum('purchased', buy, 'amount'),
  price: { amount: 0 },
})
const budgetLow = signal('budget-low', {
  meter: credits,
  field: 'remaining',
  enter: { below: 100 },
  exit: { atLeast: 150 },
})
const schema = { use, buy, credits, budgetLow }
const clients: Void<typeof schema>[] = []
const databases: DatabaseSync[] = []
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.dispose()))
  for (const db of databases.splice(0)) db.close()
  vi.useRealTimers()
})

function fixture(): Wire.CustomerState {
  const at = new Date().toISOString()
  const bucket = new Date(
    Math.floor(Date.now() / 300000) * 300000,
  ).toISOString()
  return {
    next_change_at: null,

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
    identities: [
      {
        entitlements: { features: null, meters: null },
        external_id: 'root',
        parent_external_id: null,
      },
      {
        entitlements: { features: null, meters: null },
        external_id: 'child',
        parent_external_id: 'root',
      },
    ],
    reducers: compile(defineConfig({ schema })).reducers.map((r) => ({
      ...r,
      filter: r.filter ?? null,
      map: r.map ?? null,
      id: r.slug,
      created_at: at,
      type: 'scalar',
    })),
    meters: [
      {
        usage_last_processed_event: null,
        credit_last_processed_event: null,

        meter: {
          variant_id: null,
          branch_id: null,
          currency: 'usd',
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
            credit_base: null,
            usage_base: null,
            entitlement: null,
            entitlement_usage_base: 0,

            external_identity_id: 'root',
            balance: {
              at: null,
              subscription: null,
              boundary: null,
              boundaries: [],
              cycles: {},
              credits: 120,
              usage: 0,
              remaining: 120,
              overage: 0,
            },
            base: {
              subscription: null,
              boundary: null,
              boundaries: [],
              cycles: {},
              credits: 0,
              usage: 0,
              at: '1970-01-01T00:00:00.000Z',
              remaining: 0,
              overage: 0,
            },
            is_holder: true,
            events: [],
          },
        ],
      },
    ],
    buckets: [
      {
        reducer_id: 'purchased',
        external_identity_id: 'root',
        bucket_start: bucket,
        value: 120,
        last_processed_event: {
          external_id: 'purchase',
          timestamp: at,
          ingested_at: at,
          event_ids: ['purchase'],
        },
      },
    ],
  }
}

function setup(sqlite = true, signalRefreshInterval?: number) {
  const db = sqlite ? new DatabaseSync(':memory:') : undefined
  if (db) databases.push(db)
  let snapshot = fixture()
  let status = 202
  let stateStatus = 200
  let hold: Promise<void> | undefined
  let reads = 0
  const config = defineConfig({
    schema,
    variantId: null,
    eventStorage: db ? [{ type: 'sqlite', connection: db }] : [],
    ...(signalRefreshInterval !== undefined && { signalRefreshInterval }),
  })
  const client = createVoid(config, {
    apiUrl: 'http://void',
    token: 'token',
    fetch: async (input, init) => {
      const request = new Request(input, init)
      const path = new URL(request.url).pathname
      if (path === '/v1/void/organizations/current')
        return Response.json({
          default_variant_id: null,
          id: 'org',
          name: 'Org',
          slug: 'org',
          created_at: snapshot.at,
        })
      if (path === '/v1/void/identities/root')
        return Response.json({
          entitlements: { features: null, meters: null },

          id: 'identity',
          external_id: 'root',
          parent_external_id: null,
          chain: ['root'],
          children: [],
          created_at: snapshot.at,
          metadata: {},
        })
      if (path === '/v1/void/customers/root/state') {
        reads++
        return stateStatus === 200
          ? Response.json(snapshot)
          : Response.json(
              { error: 'StateError', detail: 'Failed' },
              { status: stateStatus },
            )
      }
      if (path === '/v1/void/events') {
        await hold
        return status === 202
          ? Response.json({ saved: 1, ignored: 0 }, { status })
          : Response.json(
              { error: 'IngestError', detail: 'Rejected' },
              { status },
            )
      }
      throw new Error(`Unexpected request: ${path}`)
    },
  })
  clients.push(client)
  return {
    client,
    db,
    config,
    get snapshot() {
      return snapshot
    },
    set snapshot(value: Wire.CustomerState) {
      snapshot = value
    },
    get reads() {
      return reads
    },
    set ingestStatus(value: number) {
      status = value
    },
    set stateStatus(value: number) {
      stateStatus = value
    },
    set hold(value: Promise<void> | undefined) {
      hold = value
    },
    balance(remaining: number, processed: string[] = [], usage = 0) {
      const at = new Date().toISOString()
      snapshot = {
        ...snapshot,
        at,
        buckets: [
          { ...snapshot.buckets[0]!, value: remaining + usage },
          {
            reducer_id: 'spent',
            external_identity_id: 'root',
            bucket_start: new Date(
              Math.floor(Date.now() / 300000) * 300000,
            ).toISOString(),
            value: usage,
            last_processed_event: {
              external_id: processed.at(-1) ?? 'remote',
              timestamp: at,
              ingested_at: at,
              event_ids: processed,
            },
          },
        ],
      }
    },
  }
}

it('collects signal dependencies but does not deploy or checksum thresholds', () => {
  const config = defineConfig({ schema: { budgetLow } })
  expect(config.meters).toEqual([credits])
  expect(compile(config)).not.toHaveProperty('signals')
  const changed = defineConfig({
    schema: {
      budgetLow: signal('budget-low', {
        ...budgetLow.definition,
        enter: { below: 80 },
      }),
    },
  })
  expect(checksumOf(changed)).toBe(checksumOf(config))
  const tuned = defineConfig({
    schema: { budgetLow },
    signalRefreshInterval: 5000,
  })
  expect(tuned.signalRefreshInterval).toBe(5000)
  expect(checksumOf(tuned)).toBe(checksumOf(config))
  expect(() =>
    defineConfig({ schema: { budgetLow }, signalRefreshInterval: 0 }),
  ).toThrow('signalRefreshInterval')
  expect(() => signal('../bad', budgetLow.definition)).toThrow()
  expect(() =>
    signal('bad', { ...budgetLow.definition, enter: { below: NaN } }),
  ).toThrow()
  expect(() =>
    signal('bad', { ...budgetLow.definition, exit: { atLeast: 100 } }),
  ).toThrow()
})

const fast = { refreshInterval: 50 }

it('get evaluates locally with hysteresis and no background refresh', async () => {
  const server = setup()
  const query = server.client.as('root').signals.budgetLow
  for (const [remaining, status] of [
    [120, 'inactive'],
    [99, 'active'],
    [110, 'active'],
    [150, 'inactive'],
    [100, 'inactive'],
  ] as const) {
    server.balance(remaining)
    expect(await query.get()).toMatchObject({
      status,
      provisional: false,
      balance: { remaining },
    })
  }
  expect(server.reads).toBe(5)
})

it.each([true])(
  'reacts before upload finishes and confirms without double counting; SQLite=%s',
  async (sqlite) => {
    const server = setup(sqlite)
    const states: SignalState[] = []
    const sub = server.client.as('root').signals.budgetLow.listen(
      (state) => {
        states.push(state)
      },
      { ...fast },
    )
    await vi.waitFor(() => expect(states.at(-1)?.status).toBe('inactive'))
    let release: () => void = () => undefined
    server.hold = new Promise<void>((resolve) => {
      release = resolve
    })
    let uploaded = false
    const recording = server.client
      .as('root')
      .events.use.record({ amount: 30 }, { id: 'local' })
      .then(() => {
        uploaded = true
      })
    await vi.waitFor(() =>
      expect(states.at(-1)).toMatchObject({
        status: 'active',
        provisional: true,
        balance: { remaining: 90 },
      }),
    )
    expect(uploaded).toBe(false)
    release()
    await recording
    expect(
      (await server.client.as('root').meters.credits.balance()).remaining,
    ).toBe(90)
    expect(
      server.db!.prepare('SELECT external_id FROM polar_void_events').all(),
    ).toEqual([{ external_id: 'local' }])
    server.balance(90, ['local'], 30)
    await vi.waitFor(() =>
      expect(states.at(-1)).toMatchObject({
        status: 'active',
        provisional: false,
        balance: { remaining: 90 },
        transition: null,
      }),
    )
    expect(states.filter((s) => s.transition === 'entered')).toHaveLength(1)
    // The receipt proved the server counted it, so the buffer lets it go in the background.
    await server.client.flush()
    expect(server.db!.prepare('SELECT * FROM polar_void_events').all()).toEqual(
      [],
    )
    sub.close()
    await sub.closed
  },
)

it('without event storage signals follow the server alone', async () => {
  const server = setup(false)
  const states: SignalState[] = []
  const sub = server.client.as('root').signals.budgetLow.listen(
    (state) => {
      states.push(state)
    },
    { ...fast },
  )
  await vi.waitFor(() => expect(states.at(-1)?.status).toBe('inactive'))
  await server.client
    .as('root')
    .events.use.record({ amount: 30 }, { id: 'remote-only' })
  expect(states.at(-1)).toMatchObject({
    status: 'inactive',
    provisional: false,
    balance: { remaining: 120 },
  })
  expect(await server.client.as('root').signals.budgetLow.get()).toMatchObject({
    status: 'inactive',
    provisional: false,
  })
  server.balance(90, ['remote-only'], 30)
  await vi.waitFor(() =>
    expect(states.at(-1)).toMatchObject({
      status: 'active',
      provisional: false,
      transition: 'entered',
      balance: { remaining: 90 },
    }),
  )
  expect(states.every((s) => !s.provisional)).toBe(true)
  sub.close()
  await sub.closed
})

it('raw ingestion and descendants update root signals; unrelated identities do not', async () => {
  const { client } = setup()
  const query = client.as('root').signals.budgetLow
  await query.get()
  await client.api.events.ingest([
    {
      name: 'use',
      external_id: 'child-use',
      external_identity_id: 'child',
      metadata: { amount: 30 },
    },
  ])
  expect(await query.get()).toMatchObject({
    status: 'active',
    balance: { remaining: 90 },
  })
  await client.api.events.ingest([
    {
      name: 'use',
      external_id: 'other-use',
      external_identity_id: 'other',
      metadata: { amount: 1000 },
    },
  ])
  expect(await query.get()).toMatchObject({ balance: { remaining: 90 } })
})

it.each([true])(
  'rejected usage rolls back its balance and hysteresis; SQLite=%s',
  async (sqlite) => {
    const server = setup(sqlite)
    const query = server.client.as('root').signals.budgetLow
    await query.get()
    server.ingestStatus = 422
    await expect(
      server.client
        .as('root')
        .events.use.record({ amount: 30 }, { id: 'rejected' }),
    ).rejects.toThrow()
    expect(await query.get()).toMatchObject({
      status: 'inactive',
      balance: { remaining: 120 },
      provisional: false,
    })
    server.ingestStatus = 202
    await server.client
      .as('root')
      .events.use.record({ amount: 30 }, { id: 'rejected' })
    expect(await query.get()).toMatchObject({
      status: 'active',
      balance: { remaining: 90 },
    })
  },
)

it('keeps pending events after a transient upload failure and deduplicates retries', async () => {
  const server = setup()
  const query = server.client.as('root').signals.budgetLow
  await query.get()
  server.ingestStatus = 503
  await expect(
    server.client.as('root').events.use.record({ amount: 30 }, { id: 'retry' }),
  ).rejects.toThrow()
  expect(await query.get()).toMatchObject({
    status: 'active',
    balance: { remaining: 90 },
  })
  server.ingestStatus = 202
  await server.client
    .as('root')
    .events.use.record({ amount: 30 }, { id: 'retry' })
  expect(await query.get()).toMatchObject({ balance: { remaining: 90 } })
})

it('shares one refresh loop, suppresses unchanged observations, and stops after the last listener', async () => {
  const server = setup()
  const query = server.client.as('root').signals.budgetLow
  const first = vi.fn()
  const second = vi.fn()
  const one = query.listen(first, { ...fast })
  const two = query.listen(second, { ...fast })
  await vi.waitFor(() => expect(second).toHaveBeenCalledTimes(1))
  expect(server.reads).toBe(1)
  const reads = server.reads
  await vi.waitFor(() => expect(server.reads).toBeGreaterThan(reads))
  expect(first).toHaveBeenCalledTimes(1)
  one.close()
  await one.closed
  server.balance(90)
  await vi.waitFor(() => expect(second).toHaveBeenCalledTimes(2))
  two.close()
  await two.closed
  const settled = server.reads
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(server.reads).toBe(settled)
})

it('keeps hysteresis through unknown and resolves unlimited balances', async () => {
  const server = setup()
  server.balance(90)
  const query = server.client.as('root').signals.budgetLow
  expect((await query.get()).transition).toBe('entered')
  const valid = server.snapshot
  server.snapshot = {
    ...valid,
    identities: [
      {
        external_id: 'root',
        parent_external_id: null,
        entitlements: {
          features: null,
          meters: [],
        },
      },
    ],
  }
  expect(await query.get()).toMatchObject({
    status: 'unknown',
    transition: null,
  })
  server.snapshot = valid
  server.balance(110)
  expect(await query.get()).toMatchObject({
    status: 'active',
    transition: null,
  })
  const holder = server.snapshot.meters[0]!.holders[0]!
  server.snapshot = {
    ...server.snapshot,
    meters: [
      {
        ...server.snapshot.meters[0]!,
        holders: [
          {
            ...holder,
            base: {
              ...holder.base,
              subscription: {
                meter_interval_count: 1,
                rollover_cap: null,
                included: 0,
                ended: false,

                id: 'sub',
                at: valid.at,
                anchor: valid.at,
                meter_interval: 'month',
                limit: 'unlimited',
              },
            },
          },
        ],
      },
    ],
  }
  expect(await query.get()).toMatchObject({
    status: 'inactive',
    transition: 'exited',
  })
})

it('callback failure stops only that listener', async () => {
  const server = setup()
  const query = server.client.as('root').signals.budgetLow
  const bad = query.listen(() => {
    throw new Error('callback')
  })
  const good = vi.fn()
  const sub = query.listen(good, { ...fast })
  await expect(bad.closed).rejects.toThrow('Signal handler failed')
  server.balance(90)
  await vi.waitFor(() =>
    expect(good).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'active' }),
    ),
  )
  sub.close()
  await sub.closed
})

it('pre-aborted and disposed listeners do no work', async () => {
  const server = setup()
  const query = server.client.as('root').signals.budgetLow
  const onState = vi.fn()
  await query.listen(onState, { signal: AbortSignal.abort() }).closed
  expect(server.reads).toBe(0)
  await server.client.dispose()
  await query.listen(onState).closed
  await expect(query.get()).rejects.toThrow('disposed')
  expect(onState).not.toHaveBeenCalled()
})

it('periodic refresh picks up usage recorded by other clients', async () => {
  const server = setup()
  const onState = vi.fn()
  const sub = server.client
    .as('root')
    .signals.budgetLow.listen(onState, { ...fast })
  await vi.waitFor(() => expect(onState).toHaveBeenCalled())
  server.balance(90)
  await vi.waitFor(() =>
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'active', provisional: false }),
    ),
  )
  sub.close()
  await sub.closed
})

it('refreshes every 30 seconds by default, counted from the last refresh', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T12:04:00Z'))
  const server = setup()
  const onState = vi.fn()
  const sub = server.client.as('root').signals.budgetLow.listen(onState)
  await vi.waitFor(() => expect(onState).toHaveBeenCalled())
  expect(server.reads).toBe(1)
  await vi.advanceTimersByTimeAsync(29_000)
  expect(server.reads).toBe(1)
  await vi.advanceTimersByTimeAsync(1_100)
  expect(server.reads).toBe(2)
  await server.client.as('root').signals.budgetLow.get()
  expect(server.reads).toBe(3)
  await vi.advanceTimersByTimeAsync(29_000)
  expect(server.reads).toBe(3)
  await vi.advanceTimersByTimeAsync(1_100)
  expect(server.reads).toBe(4)
  sub.close()
  await sub.closed
  await vi.advanceTimersByTimeAsync(60_000)
  expect(server.reads).toBe(4)
})

it('retries a failed refresh without waiting for the next interval', async () => {
  const server = setup()
  const onState = vi.fn()
  const onRetry = vi.fn()
  const sub = server.client
    .as('root')
    .signals.budgetLow.listen(onState, { ...fast, onRetry })
  await vi.waitFor(() => expect(onState).toHaveBeenCalled())
  server.stateStatus = 503
  await vi.waitFor(() => expect(onRetry).toHaveBeenCalled())
  expect(onRetry.mock.calls[0]![0]).toMatchObject({ status: 503 })
  server.stateStatus = 200
  server.balance(90)
  await vi.waitFor(
    () =>
      expect(onState).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'active' }),
      ),
    { timeout: 3000 },
  )
  sub.close()
  await sub.closed
})

it('terminal snapshot errors reject done once and skip onRetry', async () => {
  const server = setup()
  server.stateStatus = 401
  const onRetry = vi.fn()
  const sub = server.client
    .as('root')
    .signals.budgetLow.listen(() => undefined, { onRetry })
  await expect(sub.closed).rejects.toMatchObject({ status: 401 })
  expect(onRetry).not.toHaveBeenCalled()
  expect(server.reads).toBe(1)
})

it('wakes at a billing boundary without a usage event or refresh', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T23:59:59Z'))
  const server = setup()
  const base: Wire.LedgerState = {
    boundaries: [],
    cycles: {},

    at: '2026-09-12T00:00:00Z',
    boundary: '2026-09-12T00:00:00Z',
    credits: 200,
    usage: 120,
    remaining: 80,
    overage: 0,
    subscription: {
      meter_interval_count: 1,
      ended: false,

      id: 'sub',
      at: '2026-09-12T00:00:00Z',
      anchor: '2026-09-12T00:00:00Z',
      meter_interval: 'day',
      included: 200,
      rollover_cap: 0,
      limit: 'hard',
    },
  }
  server.snapshot = {
    ...server.snapshot,
    since: base.at!,
    buckets: [],
    meters: [
      {
        ...server.snapshot.meters[0]!,
        holders: [
          {
            credit_base: null,
            usage_base: null,
            entitlement: null,
            entitlement_usage_base: 0,

            external_identity_id: 'root',
            base,
            balance: base,
            is_holder: true,
            events: [],
          },
        ],
      },
    ],
  }
  const states: SignalState[] = []
  const sub = server.client.as('root').signals.budgetLow.listen((state) => {
    states.push(state)
  })
  await vi.waitFor(() =>
    expect(states.at(-1)).toMatchObject({
      status: 'active',
      balance: { remaining: 80 },
    }),
  )
  await vi.advanceTimersByTimeAsync(1001)
  expect(states.at(-1)).toMatchObject({
    status: 'inactive',
    transition: 'exited',
    balance: { remaining: 200 },
  })
  sub.close()
  await sub.closed
})

it('refreshes a scheduled subscription change at its deadline', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T12:04:00Z'))
  const server = setup()
  server.snapshot = {
    ...server.snapshot,
    next_change_at: new Date(Date.now() + 2000).toISOString(),
  }
  const onState = vi.fn()
  const sub = server.client.as('root').signals.budgetLow.listen(onState)
  await vi.waitFor(() => expect(onState).toHaveBeenCalled())
  const reads = server.reads
  await vi.advanceTimersByTimeAsync(500)
  expect(server.reads).toBe(reads)
  server.balance(90)
  await vi.advanceTimersByTimeAsync(2000)
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'active' }),
  )
  sub.close()
  await sub.closed
})

it.each([true])(
  'future local events do not count early and wake at their timestamp; SQLite=%s',
  async (sqlite) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-12T12:04:00Z'))
    const server = setup(sqlite)
    const onState = vi.fn()
    const sub = server.client.as('root').signals.budgetLow.listen(onState)
    await vi.waitFor(() => expect(onState).toHaveBeenCalled())
    await server.client
      .as('root')
      .events.use.record(
        { amount: 30 },
        { id: 'future', timestamp: new Date(Date.now() + 1000) },
      )
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'inactive' }),
    )
    await vi.advanceTimersByTimeAsync(1100)
    expect(onState).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'active', provisional: true }),
    )
    sub.close()
    await sub.closed
  },
)

it('callbacks are sequential and closing suppresses queued callbacks', async () => {
  const server = setup()
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const callback = vi.fn(async () => {
    await gate
  })
  const sub = server.client.as('root').signals.budgetLow.listen(callback)
  await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1))
  await server.client
    .as('root')
    .events.use.record({ amount: 30 }, { id: 'queued' })
  expect(callback).toHaveBeenCalledTimes(1)
  sub.close()
  release()
  await sub.closed
  expect(callback).toHaveBeenCalledTimes(1)
})

it('initialStatus seeds the latch without a transition and is ignored once a state exists', async () => {
  const server = setup()
  server.balance(120)
  const query = server.client.as('root').signals.budgetLow
  const seeded = vi.fn()
  const sub = query.listen(seeded, { ...fast, initialStatus: 'active' })
  await vi.waitFor(() => expect(seeded).toHaveBeenCalledTimes(1))
  expect(seeded).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'active', transition: null }),
  )
  const late = vi.fn()
  const other = query.listen(late, { ...fast, initialStatus: 'inactive' })
  await vi.waitFor(() => expect(late).toHaveBeenCalledTimes(1))
  expect(late).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'active' }),
  )
  server.balance(160)
  await vi.waitFor(() =>
    expect(seeded).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'inactive', transition: 'exited' }),
    ),
  )
  sub.close()
  other.close()
  await Promise.all([sub.closed, other.closed])
})

it('without initialStatus a balance between the thresholds starts inactive', async () => {
  const server = setup()
  server.balance(120)
  const onState = vi.fn()
  const sub = server.client.as('root').signals.budgetLow.listen(onState)
  await vi.waitFor(() => expect(onState).toHaveBeenCalled())
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'inactive', transition: null }),
  )
  sub.close()
  await sub.closed
  expect(() =>
    server.client
      .as('root')
      .signals.budgetLow.listen(onState, { initialStatus: 'firing' as never }),
  ).toThrow('initialStatus')
})

it('config signalRefreshInterval is the default and listen can override it', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T12:04:00Z'))
  const server = setup(false, 5000)
  const onState = vi.fn()
  const query = server.client.as('root').signals.budgetLow
  const slow = query.listen(onState)
  await vi.waitFor(() => expect(onState).toHaveBeenCalled())
  expect(server.reads).toBe(1)
  await vi.advanceTimersByTimeAsync(4900)
  expect(server.reads).toBe(1)
  await vi.advanceTimersByTimeAsync(200)
  expect(server.reads).toBe(2)
  const fastOne = query.listen(onState, { refreshInterval: 1000 })
  await vi.advanceTimersByTimeAsync(1100)
  expect(server.reads).toBe(3)
  fastOne.close()
  await fastOne.closed
  const reads = server.reads
  await vi.advanceTimersByTimeAsync(1100)
  expect(server.reads).toBe(reads)
  await vi.advanceTimersByTimeAsync(4000)
  expect(server.reads).toBe(reads + 1)
  slow.close()
  await slow.closed
})

it('rejects a non-positive refresh interval', () => {
  const server = setup()
  expect(() =>
    server.client
      .as('root')
      .signals.budgetLow.listen(() => undefined, { refreshInterval: 0 }),
  ).toThrow('refreshInterval')
})
