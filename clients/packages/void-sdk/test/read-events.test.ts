import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'
import {
  persistSQLiteEvents,
  readSQLiteEvents,
  rejectSQLiteEvents,
} from '../src/storage/sqlite'

const since = new Date('2026-09-07T12:00:00.000Z')
const until = new Date('2026-09-07T13:00:00.000Z')
const event = (id: string, timestamp = since.toISOString()) => ({
  external_id: id,
  external_identity_id: 'alice',
  name: 'use',
  timestamp,
  metadata: { amount: 1 },
})

it('reads only the requested range and scope without writing to SQLite', () => {
  const db = new DatabaseSync(':memory:')
  try {
    persistSQLiteEvents(db, 'org', [
      ...Array.from({ length: 10000 }, (_, i) =>
        event(`old-${i}`, '2026-01-01T00:00:00.000Z'),
      ),
      event('boundary'),
      event('same-time'),
      event('end', until.toISOString()),
      event('future', '2027-01-01T00:00:00.000Z'),
      { ...event('bob'), external_identity_id: 'bob' },
      { ...event('other-name'), name: 'buy' },
    ])
    persistSQLiteEvents(db, 'other-org', [event('other-org')])
    db.exec('PRAGMA query_only = ON')
    const read = () =>
      readSQLiteEvents(db, 'org', ['use'], ['alice'], since, until)
    expect(read().map((e) => e.external_id)).toEqual([
      'boundary',
      'same-time',
      'end',
    ])
    expect(read().map((e) => e.external_id)).toEqual([
      'boundary',
      'same-time',
      'end',
    ])
    expect(
      readSQLiteEvents(db, 'org', ['use'], ['alice'], null, until),
    ).toHaveLength(10003)
    expect(readSQLiteEvents(db, 'org', [], ['alice'], since, until)).toEqual([])
    expect(readSQLiteEvents(db, 'org', ['use'], [], since, until)).toEqual([])
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(),
    ).toEqual([
      { name: 'polar_void_events' },
      { name: 'polar_void_rejected_events' },
    ])
  } finally {
    db.close()
  }
})

it('returns no events from an unused database without initializing storage', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec('PRAGMA query_only = ON')
    expect(
      readSQLiteEvents(db, 'org', ['use'], ['alice'], since, until),
    ).toEqual([])
    expect(db.prepare('SELECT name FROM sqlite_master').all()).toEqual([])
  } finally {
    db.close()
  }
})

it('rejected events leave reconciliation until the same id is persisted again', () => {
  const db = new DatabaseSync(':memory:')
  try {
    persistSQLiteEvents(db, 'org', [event('kept'), event('rejected')])
    persistSQLiteEvents(db, 'other-org', [event('rejected')])
    rejectSQLiteEvents(db, 'org', [event('rejected'), event('never-stored')])
    const ids = (org: string) =>
      readSQLiteEvents(db, org, ['use'], ['alice'], since, until).map(
        (e) => e.external_id,
      )
    expect(ids('org')).toEqual(['kept'])
    expect(ids('other-org')).toEqual(['rejected'])
    expect(db.prepare('SELECT * FROM polar_void_events').all()).toHaveLength(3)
    // A retry with the same id is a fresh attempt at the server.
    persistSQLiteEvents(db, 'org', [event('rejected')])
    expect(ids('org')).toEqual(['kept', 'rejected'])
    expect(
      db.prepare('SELECT * FROM polar_void_rejected_events').all(),
    ).toEqual([{ organization_id: 'org', external_id: 'never-stored' }])
  } finally {
    db.close()
  }
})
