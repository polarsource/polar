import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import {
  checksumOf,
  compile,
  createVoid,
  defineConfig,
  event,
  memoryEventStorage,
  VoidError,
  type EventStorage,
  type SQLiteConnection,
  type Void,
  type Wire,
} from '../src/index'

const schema = { usage: event<{ tokens: number }>('usage') }
const databases: DatabaseSync[] = []
const clients: Void<typeof schema>[] = []
const database = () => {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  return db
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.dispose()))
  await Promise.all(databases.splice(0).map((db) => db.close()))
})

const setup = (
  connections: (SQLiteConnection | EventStorage)[],
  options: {
    organizationId?: string
    beforeIngest?: (events: Wire.EventsIngestRequestJson) => Promise<void>
    failApi?: () => boolean
    eventRetention?: number
  } = {},
) => {
  const sent: Wire.EventsIngestRequestJson[] = []
  const requests: string[] = []
  const client = createVoid(
    defineConfig({
      schema,
      eventStorage: connections.map((connection) =>
        'persist' in connection ? connection : { type: 'sqlite', connection },
      ),
      ...(options.eventRetention !== undefined && {
        eventRetention: options.eventRetention,
      }),
    }),
    {
      apiUrl: 'http://void',
      token: 'token',
      fetch: async (input, init) => {
        const request = new Request(input, init)
        const path = new URL(request.url).pathname
        requests.push(path)
        if (path === '/v1/void/organizations/current')
          return Response.json({
            active_version_id: 'a'.repeat(64),
            active_deployment_id: 'deployment',
            can_activate: true,
            id: options.organizationId ?? 'org_1',
            name: 'Demo',
            slug: 'demo',
            created_at: '2026-09-07T00:00:00Z',
          })
        if (path !== '/v1/void/events')
          throw new Error(`Unexpected request: ${path}`)
        const events = (await request.json()) as Wire.EventsIngestRequestJson
        await options.beforeIngest?.(events)
        sent.push(events)
        return options.failApi?.()
          ? Response.json(
              { error: 'Unavailable', detail: 'retry' },
              { status: 503 },
            )
          : Response.json({ saved: events.length, ignored: 0 }, { status: 202 })
      },
    },
  )
  clients.push(client)
  return { client, sent, requests }
}

it('persists scoped events and raw batches before sending the exact stored payload', async () => {
  const db = database()
  const { client, sent } = setup([db], {
    beforeIngest: async (events) => {
      const rows = db.prepare('SELECT * FROM polar_void_events').all()
      for (const event of events) {
        const row = rows.find((row) => row.external_id === event.external_id)!
        expect(JSON.parse(String(row.metadata))).toEqual(event.metadata)
        expect(new Date(String(row.timestamp)).toISOString()).toBe(
          new Date(event.timestamp!).toISOString(),
        )
      }
    },
  })
  await client.as('alice').events.usage.record({ tokens: 3 })
  await client.api.events.ingest([
    {
      external_id: "event'1",
      name: 'usage',
      external_identity_id: 'bob',
      timestamp: '2026-01-01T13:00:00+01:00',
      metadata: { nested: { values: [1, true, null, '日本語'] } },
    },
    { external_id: 'event2', name: 'system' },
  ])
  expect(sent[0]![0]!.external_id).toMatch(/^[0-9a-f-]{36}$/)
  expect(sent[1]![0]!.timestamp).toBe('2026-01-01T12:00:00.000Z')
  expect(sent[1]![1]).toMatchObject({
    metadata: {},
    external_identity_id: null,
  })
  expect(db.prepare('SELECT * FROM polar_void_events').all()).toHaveLength(3)
})

it('retains events on API failure and retries the original payload without duplicating rows', async () => {
  const db = database()
  let fail = true
  const { client, sent } = setup([db], { failApi: () => fail })
  await expect(
    client.as('alice').events.usage.record({ tokens: 3 }, { id: 'retry' }),
  ).rejects.toMatchObject({ status: 503 })
  fail = false
  await client.as('bob').events.usage.record({ tokens: 999 }, { id: 'retry' })
  expect(sent[1]).toEqual(sent[0])
  expect(db.prepare('SELECT * FROM polar_void_events').all()).toHaveLength(1)
})

it('blocks API ingestion on a database failure and retries initialization', async () => {
  const db = database()
  let fail = true
  const connection: SQLiteConnection = {
    prepare: (sql) => db.prepare(sql),
    exec: (sql) => {
      if (fail) throw new Error('offline')
      db.exec(sql)
    },
  }
  const { client, sent } = setup([connection])
  await expect(
    client.as('alice').events.usage.record({ tokens: 1 }),
  ).rejects.toBeInstanceOf(VoidError)
  expect(sent).toHaveLength(0)
  fail = false
  await client.as('alice').events.usage.record({ tokens: 1 })
  expect(sent).toHaveLength(1)
})

it('writes batches atomically and blocks HTTP when inserting a row fails', async () => {
  const db = database()
  const { client, sent } = setup([db])
  await expect(
    client.api.events.ingest([
      { external_id: 'valid', name: 'usage' },
      { external_id: 'invalid', name: 'usage', timestamp: 'invalid' },
    ]),
  ).rejects.toMatchObject({ reason: 'event_storage' })
  expect(db.prepare('SELECT * FROM polar_void_events').all()).toHaveLength(0)
  expect(sent).toHaveLength(0)
})

it('requires every destination and fills a failed destination on retry', async () => {
  const first = database()
  const second = database()
  let fail = true
  const connection: SQLiteConnection = {
    prepare: (sql) => second.prepare(sql),
    exec: (sql) => {
      if (fail) throw new Error('offline')
      second.exec(sql)
    },
  }
  const { client, sent } = setup([first, connection])
  await expect(
    client.as('alice').events.usage.record({ tokens: 1 }, { id: 'same' }),
  ).rejects.toMatchObject({ reason: 'event_storage' })
  expect(first.prepare('SELECT * FROM polar_void_events').all()).toHaveLength(1)
  expect(sent).toHaveLength(0)
  fail = false
  await client.as('alice').events.usage.record({ tokens: 1 }, { id: 'same' })
  expect(second.prepare('SELECT * FROM polar_void_events').all()).toHaveLength(
    1,
  )
  expect(sent).toHaveLength(1)
})

it('isolates organizations sharing a connection and deduplicates within batches', async () => {
  const db = database()
  const one = setup([db])
  const two = setup([db], { organizationId: 'org_2' })
  await Promise.all(
    [one, two].map(({ client }, index) =>
      client.api.events.ingest([
        { external_id: 'same', name: 'usage', metadata: { index } },
        { external_id: 'same', name: 'ignored' },
      ]),
    ),
  )
  const rows = db.prepare('SELECT * FROM polar_void_events').all()
  expect(rows).toHaveLength(2)
  expect(rows.every((row) => row.name === 'usage')).toBe(true)
})

it('rejects conflicting copies across databases instead of sending inconsistent events', async () => {
  const first = database()
  const second = database()
  await setup([first])
    .client.as('alice')
    .events.usage.record({ tokens: 1 }, { id: 'conflict' })
  await setup([second])
    .client.as('alice')
    .events.usage.record({ tokens: 2 }, { id: 'conflict' })
  const { client, sent } = setup([first, second])
  await expect(
    client.as('alice').events.usage.record({ tokens: 1 }, { id: 'conflict' }),
  ).rejects.toMatchObject({ reason: 'event_storage' })
  expect(sent).toHaveLength(0)
})

it('keeps connections out of compiled config and checksums and never closes caller connections', async () => {
  const db = database()
  const { client, requests } = setup([db])
  const plain = defineConfig({ schema })
  expect(compile(client.config)).toEqual(compile(plain))
  expect(checksumOf(client.config)).toBe(checksumOf(plain))
  expect(requests).toEqual([])
  await client.dispose()
  expect(db.prepare('SELECT 1 AS alive').all()).toEqual([{ alive: 1 }])
})

it('does not touch storage for an empty batch', async () => {
  const { client, requests } = setup([
    {
      prepare: () => {
        throw new Error('must not connect')
      },
      exec: () => {
        throw new Error('must not connect')
      },
    },
  ])
  await client.api.events.ingest([])
  expect(requests).toEqual(['/v1/void/events'])
})

it('commits to a file before HTTP and retains events after closing and reopening', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'void-storage-'))
  const file = join(directory, 'app.db')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE app_users (id TEXT PRIMARY KEY)')
  db.prepare('INSERT INTO app_users VALUES (?)').run('alice')
  const observer = new DatabaseSync(file)
  const { client } = setup([db], {
    beforeIngest: async () => {
      expect(
        observer
          .prepare('SELECT COUNT(*) AS count FROM polar_void_events')
          .get()?.count,
      ).toBe(1)
    },
  })
  try {
    await client
      .as('alice')
      .events.usage.record({ tokens: 5 }, { id: 'durable' })
    expect(db.prepare('SELECT * FROM app_users').all()).toEqual([
      { id: 'alice' },
    ])
    await client.dispose()
    db.close()
    const reopened = new DatabaseSync(file)
    try {
      expect(
        reopened.prepare('SELECT external_id FROM polar_void_events').all(),
      ).toEqual([{ external_id: 'durable' }])
    } finally {
      reopened.close()
    }
  } finally {
    if (db.isOpen) db.close()
    observer.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

it('rejects open application transactions without committing or rolling them back', async () => {
  const db = database()
  const { client, sent } = setup([db])
  db.exec('CREATE TABLE app_users (id TEXT)')
  // Test both before and after the SDK has initialized its schema.
  for (let attempt = 0; attempt < 2; attempt++) {
    db.exec('BEGIN')
    db.prepare('INSERT INTO app_users VALUES (?)').run('uncommitted')
    await expect(
      client.as('alice').events.usage.record({ tokens: 1 }),
    ).rejects.toMatchObject({ reason: 'event_storage' })
    expect(db.isTransaction).toBe(true)
    expect(db.prepare('SELECT * FROM app_users').all()).toHaveLength(1)
    expect(sent).toHaveLength(attempt)
    db.exec('ROLLBACK')
    expect(db.prepare('SELECT * FROM app_users').all()).toHaveLength(0)
    await client.as('alice').events.usage.record({ tokens: 1 })
  }
})

it('rolls back the entire event batch when an insert violates a database constraint', async () => {
  const db = database()
  const { client, sent } = setup([db])
  await client
    .as('alice')
    .events.usage.record({ tokens: 1 }, { id: 'existing' })
  db.exec(`CREATE TRIGGER reject_event BEFORE INSERT ON polar_void_events
    WHEN NEW.external_id = 'rejected'
    BEGIN SELECT RAISE(ABORT, 'write failed'); END`)
  await expect(
    client.api.events.ingest([
      { external_id: 'first', name: 'usage' },
      { external_id: 'rejected', name: 'usage' },
    ]),
  ).rejects.toMatchObject({ reason: 'event_storage' })
  expect(db.prepare('SELECT external_id FROM polar_void_events').all()).toEqual(
    [{ external_id: 'existing' }],
  )
  expect(sent).toHaveLength(1)
})

it('prunes events older than the retention on every record and validates the setting', async () => {
  const db = database()
  const { client } = setup([db], { eventRetention: 60 * 60 * 1000 })
  await client.as('alice').events.usage.record({ tokens: 1 }, { id: 'first' })
  db.prepare(
    "UPDATE polar_void_events SET recorded_at = '2020-01-01T00:00:00.000Z' WHERE external_id = 'first'",
  ).run()
  await client.as('alice').events.usage.record({ tokens: 1 }, { id: 'second' })
  expect(db.prepare('SELECT external_id FROM polar_void_events').all()).toEqual(
    [{ external_id: 'second' }],
  )
  expect(defineConfig({ schema }).eventRetention).toBe(7 * 24 * 60 * 60 * 1000)
  expect(() => defineConfig({ schema, eventRetention: 0 })).toThrow(
    'eventRetention',
  )
  expect(checksumOf(defineConfig({ schema, eventRetention: 1 }))).toBe(
    checksumOf(defineConfig({ schema })),
  )
})

it('chains a promise-returning adapter after SQLite and detects drift through the contract', async () => {
  const db = database()
  const memory = memoryEventStorage()
  const remote: EventStorage = {
    type: 'remote',
    persist: async (org, events) => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      return memory.persist(org, events)
    },
    reject: async (org, events) => memory.reject(org, events),
    forget: async (org, ids) => memory.forget(org, ids),
    read: async (org, range) => memory.read(org, range),
  }
  const { client, sent } = setup([db, remote])
  await client.as('alice').events.usage.record({ tokens: 1 }, { id: 'both' })
  expect(sent).toHaveLength(1)
  expect(memory.rows().map((row) => row.external_id)).toEqual(['both'])
  expect(db.prepare('SELECT external_id FROM polar_void_events').all()).toEqual(
    [{ external_id: 'both' }],
  )
  // A different copy already in the remote store blocks ingestion.
  await memory.persist('org_1', [
    {
      external_id: 'drift',
      name: 'usage',
      external_identity_id: 'alice',
      timestamp: new Date().toISOString(),
      metadata: { tokens: 2 },
    },
  ])
  await expect(
    client.as('alice').events.usage.record({ tokens: 1 }, { id: 'drift' }),
  ).rejects.toMatchObject({ reason: 'event_storage' })
  expect(sent).toHaveLength(1)
})

it('names the failing adapter and blocks ingestion when it rejects', async () => {
  const broken: EventStorage = {
    type: 'flaky',
    persist: () => Promise.reject(new Error('down')),
    reject: () => undefined,
    forget: () => undefined,
    read: () => [],
  }
  const { client, sent } = setup([database(), broken])
  await expect(
    client.as('alice').events.usage.record({ tokens: 1 }),
  ).rejects.toMatchObject({
    reason: 'event_storage',
    message: 'void: flaky event storage 1 failed',
  })
  expect(sent).toHaveLength(0)
})

// oxlint-disable-next-line no-constant-condition -- Compile-time assertions must not execute.
if (false) {
  defineConfig({
    schema,
    // @ts-expect-error only supported database types are accepted
    eventStorage: [{ type: 'clickhouse', connection: database() }],
  })
  defineConfig({
    schema,
    // @ts-expect-error an adapter must implement the whole contract
    eventStorage: [{ type: 'partial', persist: async () => [] }],
  })
  defineConfig({
    schema,
    // @ts-expect-error a path is not a database connection
    eventStorage: [{ type: 'sqlite', connection: 'data/events.db' }],
  })
}
