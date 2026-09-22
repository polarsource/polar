import { memoryEventStorage } from '@void/sdk'
import { describe, expect, it } from 'vitest'
import { reconcile } from '@/scenes/ledger'
import { DEFAULT_RETENTION, frames } from './local-events'

const ORG = 'org_acme'
const event = (
  id: string,
  amount: number,
  timestamp = '2026-09-21T12:00:00.000Z',
) => ({
  name: 'credits.used',
  external_id: id,
  external_identity_id: 'acme',
  timestamp,
  metadata: { amount, kind: 'completion' },
})
const range = {
  names: ['credits.used'],
  identities: ['acme'],
  since: null,
  until: new Date('2026-12-31T00:00:00.000Z'),
  recordedSince: null,
}

describe('local events chapter', () => {
  it('reconciles the way the prose says', () => {
    const recorded = reconcile(frames.recorded!, 1_000, 640)
    expect(recorded).toMatchObject({
      remoteRemaining: 360,
      remaining: 330,
      localAdjustment: -30,
      eventCount: 1,
      applied: true,
    })
    expect(reconcile(frames.confirmed!, 1_000, 640)).toMatchObject({
      remoteRemaining: 330,
      remaining: 330,
      applied: false,
    })
    expect(reconcile(frames.failed!, 1_000, 640).remaining).toBe(285)
    expect(reconcile(frames.refused!, 1_000, 640).remaining).toBe(285)
    expect(reconcile(frames.swept!, 1_000, 640).remaining).toBe(275)
  })

  it('keeps the first copy, excludes rejections, forgets on receipt', async () => {
    const storage = memoryEventStorage()
    await storage.persist(ORG, [event('evt_01', 30)])
    const [again] = await storage.persist(ORG, [event('evt_01', 999)])
    expect(again!.metadata).toEqual({ amount: 30, kind: 'completion' })

    await storage.persist(ORG, [event('evt_03', 20)])
    await storage.reject(ORG, [event('evt_03', 20)])
    expect((await storage.read(ORG, range)).map((e) => e.external_id)).toEqual([
      'evt_01',
    ])

    await storage.persist(ORG, [event('evt_03', 20)])
    expect((await storage.read(ORG, range)).map((e) => e.external_id)).toEqual([
      'evt_01',
      'evt_03',
    ])

    await storage.forget(ORG, ['evt_01'])
    expect((await storage.read(ORG, range)).map((e) => e.external_id)).toEqual([
      'evt_03',
    ])
  })

  it('prunes old unconfirmed events in the same write', async () => {
    const storage = memoryEventStorage()
    await storage.persist(ORG, [event('evt_00', 12)])
    const later = new Date(Date.now() + 1_000)
    await storage.persist(ORG, [event('evt_04', 10)], { pruneBefore: later })
    expect(storage.rows().map((e) => e.external_id)).toEqual(['evt_04'])
    expect(DEFAULT_RETENTION).toBe(7 * 24 * 60 * 60 * 1000)
  })
})
