import { describe, expect, it } from 'vitest'
import type { Wire } from '../src/index'
import type { EventStorage } from '../src/storage/storage'

export interface StorageHarness {
  readonly storage: EventStorage
  close?(): void | Promise<void>
}

const since = new Date('2026-09-07T12:00:00.000Z')
const until = new Date('2026-09-07T13:00:00.000Z')
const event = (
  id: string,
  timestamp = since.toISOString(),
  extra: Partial<Required<Wire.EventCreate>> = {},
): Required<Wire.EventCreate> => ({
  external_id: id,
  external_identity_id: 'alice',
  name: 'use',
  timestamp,
  metadata: { amount: 1 },
  ...extra,
})
const range = (
  overrides: Partial<Parameters<EventStorage['read']>[1]> = {},
) => ({
  names: ['use'],
  identities: ['alice'],
  since,
  until,
  recordedSince: null,
  ...overrides,
})

/** The behaviour every `EventStorage` adapter must provide. */
export function describeEventStorage(
  name: string,
  make: () => StorageHarness | Promise<StorageHarness>,
): void {
  const withStorage = async (run: (storage: EventStorage) => Promise<void>) => {
    const harness = await make()
    try {
      await run(harness.storage)
    } finally {
      await harness.close?.()
    }
  }
  const ids = async (storage: EventStorage, org = 'org', r = range()) =>
    (await storage.read(org, r)).map((e) => e.external_id)

  describe(`${name} event storage`, () => {
    it('returns the stored form and normalizes timestamps', () =>
      withStorage(async (storage) => {
        const stored = await storage.persist('org', [
          event('a', '2026-09-07T14:00:00+02:00', {
            metadata: { nested: [1, true, null, '日本語'] },
          }),
        ])
        expect(stored).toEqual([
          {
            external_id: 'a',
            external_identity_id: 'alice',
            name: 'use',
            timestamp: '2026-09-07T12:00:00.000Z',
            metadata: { nested: [1, true, null, '日本語'] },
          },
        ])
        const [read] = await storage.read('org', range())
        expect(read).toMatchObject({ ...stored[0], organization_id: 'org' })
        expect(typeof read!.recorded_at).toBe('string')
        expect(Number.isNaN(Date.parse(read!.recorded_at))).toBe(false)
      }))

    it('keeps the first copy of an id and returns it to later writers', () =>
      withStorage(async (storage) => {
        await storage.persist('org', [
          event('same', undefined, { metadata: { amount: 1 } }),
        ])
        const again = await storage.persist('org', [
          event('same', undefined, { metadata: { amount: 2 } }),
          event('new'),
        ])
        expect(again.map((e) => e.metadata)).toEqual([
          { amount: 1 },
          { amount: 1 },
        ])
        expect(await ids(storage)).toEqual(['new', 'same'])
      }))

    it('treats a repeated id inside one batch as one event', () =>
      withStorage(async (storage) => {
        const stored = await storage.persist('org', [
          event('dup', undefined, { metadata: { copy: 1 } }),
          event('dup', undefined, { metadata: { copy: 2 } }),
        ])
        expect(stored.map((e) => e.metadata)).toEqual([
          { copy: 1 },
          { copy: 1 },
        ])
        expect(await ids(storage)).toEqual(['dup'])
      }))

    it('isolates organizations sharing a store', () =>
      withStorage(async (storage) => {
        await storage.persist('org', [
          event('shared', undefined, { metadata: { org: 1 } }),
        ])
        await storage.persist('other', [
          event('shared', undefined, { metadata: { org: 2 } }),
        ])
        expect((await storage.read('org', range()))[0]!.metadata).toEqual({
          org: 1,
        })
        expect((await storage.read('other', range()))[0]!.metadata).toEqual({
          org: 2,
        })
        expect(await ids(storage, 'nobody')).toEqual([])
      }))

    it('stores nothing from a batch that contains an invalid event', () =>
      withStorage(async (storage) => {
        // Adapters may throw synchronously; the SDK lifts both into the same failure.
        await expect(
          Promise.resolve().then(() =>
            storage.persist('org', [
              event('valid'),
              event('invalid', 'not a date'),
            ]),
          ),
        ).rejects.toBeDefined()
        expect(await ids(storage)).toEqual([])
      }))

    it('reads an inclusive range in (timestamp, external_id) order and filters names and identities', () =>
      withStorage(async (storage) => {
        await storage.persist('org', [
          event('late', until.toISOString()),
          event('b'),
          event('a'),
          event('before', '2026-09-07T11:59:59.999Z'),
          event('after', '2026-09-07T13:00:00.001Z'),
          event('bob', undefined, { external_identity_id: 'bob' }),
          event('anonymous', undefined, { external_identity_id: null }),
          event('buy', undefined, { name: 'buy' }),
        ])
        expect(await ids(storage)).toEqual(['a', 'b', 'late'])
        expect(await ids(storage, 'org', range({ since: null }))).toEqual([
          'before',
          'a',
          'b',
          'late',
        ])
        expect(
          await ids(
            storage,
            'org',
            range({ identities: ['alice', 'bob'], names: ['use', 'buy'] }),
          ),
        ).toEqual(['a', 'b', 'bob', 'buy', 'late'])
        expect(await ids(storage, 'org', range({ names: [] }))).toEqual([])
        expect(await ids(storage, 'org', range({ identities: [] }))).toEqual([])
      }))

    it('hides rejected ids until the same id is persisted again', () =>
      withStorage(async (storage) => {
        await storage.persist('org', [event('kept'), event('rejected')])
        await storage.persist('other', [event('rejected')])
        await storage.reject('org', [event('rejected'), event('never-stored')])
        await storage.reject('org', [event('rejected')])
        expect(await ids(storage)).toEqual(['kept'])
        expect(await ids(storage, 'other')).toEqual(['rejected'])
        const retried = await storage.persist('org', [event('rejected')])
        expect(retried).toHaveLength(1)
        expect(await ids(storage)).toEqual(['kept', 'rejected'])
      }))

    it('bounds reads by recording time', () =>
      withStorage(async (storage) => {
        await storage.persist('org', [event('now')])
        const future = new Date(Date.now() + 60_000)
        const past = new Date(Date.now() - 60_000)
        expect(
          await ids(storage, 'org', range({ recordedSince: past })),
        ).toEqual(['now'])
        expect(
          await ids(storage, 'org', range({ recordedSince: future })),
        ).toEqual([])
      }))

    it('prunes events recorded before the cutoff and their orphaned rejections in the same write', () =>
      withStorage(async (storage) => {
        await storage.persist('org', [event('old'), event('old-rejected')])
        await storage.persist('other', [event('old')])
        await storage.reject('org', [event('old-rejected')])
        const before = new Date(Date.now() - 60_000)
        // A cutoff in the past keeps everything.
        await storage.persist('org', [event('kept')], { pruneBefore: before })
        expect(await ids(storage)).toEqual(['kept', 'old'])
        // A cutoff in the future removes every earlier row of this organization,
        // and the batch being written lands after the prune.
        const after = new Date(Date.now() + 60_000)
        await storage.persist('org', [event('fresh')], { pruneBefore: after })
        expect(await ids(storage)).toEqual(['fresh'])
        expect(await ids(storage, 'other')).toEqual(['old'])
        // The rejection mark went with its event, so the id starts clean.
        await storage.persist('org', [event('old-rejected')])
        expect(await ids(storage)).toEqual(['fresh', 'old-rejected'])
      }))

    it('forgets named events and their rejection marks, idempotently', () =>
      withStorage(async (storage) => {
        await storage.persist('org', [event('a'), event('b'), event('c')])
        await storage.persist('other', [event('a')])
        await storage.reject('org', [event('b')])
        await storage.forget('org', ['a', 'b', 'missing'])
        await storage.forget('org', ['a'])
        await storage.forget('org', [])
        expect(await ids(storage)).toEqual(['c'])
        expect(await ids(storage, 'other')).toEqual(['a'])
        await storage.persist('org', [event('b')])
        expect(await ids(storage)).toEqual(['b', 'c'])
      }))

    it('returns copies that callers cannot mutate into the store', () =>
      withStorage(async (storage) => {
        await storage.persist('org', [event('a')])
        const [first] = await storage.read('org', range())
        ;(first!.metadata as Record<string, unknown>).amount = 99
        const [second] = await storage.read('org', range())
        expect(second!.metadata).toEqual({ amount: 1 })
      }))
  })
}
