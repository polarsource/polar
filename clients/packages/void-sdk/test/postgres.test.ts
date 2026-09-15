import { DatabaseSync } from 'node:sqlite'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createVoid,
  defineConfig,
  event,
  initializePostgresEventStorage,
  postgresEventStorage,
  type EventStorage,
  type Wire,
} from '../src/index'
import { describeEventStorage } from './event-storage.conformance'

// Needs a database: VOID_TEST_DATABASE_URL=postgres://void:void@localhost:5432/void_sdk_test
const url = process.env.VOID_TEST_DATABASE_URL
const pool = url ? new Pool({ connectionString: url, max: 4 }) : undefined
afterAll(() => pool?.end())

/** Counts statements, so tests can pin the one-statement-per-operation design. */
const counting = (target: Pool) => {
  const statements: string[] = []
  const connection = {
    query: (text: string, params: unknown[]) => {
      statements.push(text)
      return target.query(text, params)
    },
  }
  return { connection, statements }
}

const reset = async (target: Pool) => {
  await initializePostgresEventStorage(target)
  await target.query(
    'TRUNCATE polar_void_events, polar_void_rejected_events',
    [],
  )
}

describe.skipIf(!pool)('postgres', () => {
  describeEventStorage('postgres', async () => {
    await reset(pool!)
    return { storage: postgresEventStorage(pool!) }
  })

  it('issues exactly one statement per operation and never opens a transaction', async () => {
    await reset(pool!)
    const { connection, statements } = counting(pool!)
    const storage = postgresEventStorage(connection)
    const at = new Date('2026-09-07T12:00:00.000Z')
    const sample: Required<Wire.EventCreate> = {
      external_id: 'one',
      external_identity_id: 'alice',
      name: 'use',
      timestamp: at.toISOString(),
      metadata: {},
    }
    await storage.persist('org', [sample, { ...sample, external_id: 'two' }])
    await storage.reject('org', [sample])
    await storage.read('org', {
      names: ['use'],
      identities: ['alice'],
      since: null,
      until: at,
      recordedSince: null,
    })
    await storage.forget('org', ['two'])
    expect(statements).toHaveLength(4)
    expect(statements.join('\n')).not.toMatch(/\b(BEGIN|COMMIT)\b/)
  })

  it('creates tables on first use when asked, once, and reports missing tables otherwise', async () => {
    await pool!.query(
      'DROP TABLE IF EXISTS polar_void_events, polar_void_rejected_events',
      [],
    )
    const range = {
      names: ['use'],
      identities: ['alice'],
      since: null,
      until: new Date(),
      recordedSince: null,
    }
    await expect(
      postgresEventStorage(pool!).read('org', range),
    ).rejects.toThrow(/postgresEventStorageSchema/)
    const { connection, statements } = counting(pool!)
    const storage = postgresEventStorage(connection, { createTables: true })
    expect(await storage.read('org', range)).toEqual([])
    expect(await storage.read('org', range)).toEqual([])
    expect(statements.filter((s) => s.startsWith('CREATE'))).toHaveLength(5)
  })

  it('accepts a postgres.js-shaped client through unsafe', async () => {
    await reset(pool!)
    const storage = postgresEventStorage({
      unsafe: (text, params) => pool!.query(text, params).then((r) => r.rows),
    })
    await storage.persist('org', [
      {
        external_id: 'js',
        external_identity_id: 'alice',
        name: 'use',
        timestamp: '2026-09-07T12:00:00.000Z',
        metadata: { ok: true },
      },
    ])
    const rows = await storage.read('org', {
      names: ['use'],
      identities: ['alice'],
      since: null,
      until: new Date('2026-09-07T13:00:00.000Z'),
      recordedSince: null,
    })
    expect(rows.map((r) => r.external_id)).toEqual(['js'])
  })

  it('reconciles a check from SQLite and Postgres together through the client', async () => {
    await reset(pool!)
    const db = new DatabaseSync(':memory:')
    const schema = { usage: event<{ tokens: number }>('usage') }
    const sent: Wire.EventsIngestRequestJson[] = []
    const client = createVoid(
      defineConfig({
        schema,
        eventStorage: [
          { type: 'sqlite', connection: db },
          postgresEventStorage(pool!) satisfies EventStorage,
        ],
      }),
      {
        apiUrl: 'http://void',
        token: 'token',
        fetch: async (input, init) => {
          const request = new Request(input, init)
          const path = new URL(request.url).pathname
          if (path === '/v1/organizations/current')
            return Response.json({
              id: 'org_pg',
              name: 'Demo',
              slug: 'demo',
              created_at: '2026-09-07T00:00:00Z',
            })
          sent.push((await request.json()) as Wire.EventsIngestRequestJson)
          return Response.json({ saved: 1, ignored: 0 }, { status: 202 })
        },
      },
    )
    try {
      await client
        .as('alice')
        .events.usage.record({ tokens: 3 }, { id: 'shared' })
      expect(sent).toHaveLength(1)
      const { rows } = await pool!.query(
        'SELECT external_id, metadata FROM polar_void_events',
        [],
      )
      expect(rows).toEqual([{ external_id: 'shared', metadata: { tokens: 3 } }])
      expect(
        db.prepare('SELECT external_id FROM polar_void_events').all(),
      ).toEqual([{ external_id: 'shared' }])
    } finally {
      await client.dispose()
      db.close()
    }
  })
})
