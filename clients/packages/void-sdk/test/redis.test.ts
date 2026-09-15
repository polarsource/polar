import { Redis as Upstash } from '@upstash/redis'
import { Redis } from 'ioredis'
import { afterAll, describe, expect, it } from 'vitest'
import { redisEventStorage, type Wire } from '../src/index'
import type { RedisConnection } from '../src/storage/redis'
import { describeEventStorage } from './event-storage.conformance'

// Needs a server: VOID_TEST_REDIS_URL=redis://localhost:6379
const url = process.env.VOID_TEST_REDIS_URL
const socket = url ? new Redis(url, { lazyConnect: true }) : undefined
afterAll(() => socket?.quit())

// Needs a database: VOID_TEST_UPSTASH_REDIS_REST_URL and VOID_TEST_UPSTASH_REDIS_REST_TOKEN
const restUrl = process.env.VOID_TEST_UPSTASH_REDIS_REST_URL
const restToken = process.env.VOID_TEST_UPSTASH_REDIS_REST_TOKEN
const upstash =
  restUrl && restToken
    ? new Upstash({ url: restUrl, token: restToken })
    : undefined

const sample: Required<Wire.EventCreate> = {
  external_id: 'one',
  external_identity_id: 'alice',
  name: 'use',
  timestamp: '2026-09-07T12:00:00.000Z',
  metadata: {},
}
const range = {
  names: ['use'],
  identities: ['alice'],
  since: null,
  until: new Date('2026-09-07T13:00:00.000Z'),
  recordedSince: null,
}

/** Counts scripts, so tests can pin the one-eval-per-operation design. */
const counting = (target: RedisConnection) => {
  const scripts: string[] = []
  const connection: RedisConnection = {
    eval: (script, keys, args) => {
      scripts.push(script)
      return target.eval(script, keys, args)
    },
  }
  return { connection, scripts }
}

describe.skipIf(!socket)('redis over a socket', () => {
  describeEventStorage('ioredis', async () => {
    await socket!.flushdb()
    return { storage: redisEventStorage(socket!) }
  })

  it('issues exactly one script per operation', async () => {
    await socket!.flushdb()
    const { connection, scripts } = counting({
      eval: (script, keys, args) =>
        socket!.eval(script, keys.length, ...keys, ...args),
    })
    const storage = redisEventStorage(connection)
    await storage.persist('org', [sample, { ...sample, external_id: 'two' }])
    await storage.reject('org', [sample])
    await storage.read('org', range)
    await storage.forget('org', ['two'])
    expect(scripts).toHaveLength(4)
  })

  it('expires event keys after the retention implied by pruneBefore', async () => {
    await socket!.flushdb()
    const storage = redisEventStorage(socket!)
    const retention = 60_000
    await storage.persist('org', [sample], {
      pruneBefore: new Date(Date.now() - retention),
    })
    const ttl = await socket!.pttl('polar_void:{org}:event:one')
    expect(ttl).toBeGreaterThan(retention - 5_000)
    expect(ttl).toBeLessThanOrEqual(retention)
    expect(
      await socket!.pttl('polar_void:{org}:identity:alice'),
    ).toBeGreaterThan(0)
    expect(await socket!.pttl('polar_void:{org}:recorded')).toBeGreaterThan(0)
  })

  it('skips an event whose key expired ahead of its index entry', async () => {
    await socket!.flushdb()
    const storage = redisEventStorage(socket!)
    await storage.persist('org', [sample, { ...sample, external_id: 'two' }])
    await socket!.del('polar_void:{org}:event:one')
    expect(
      (await storage.read('org', range)).map((e) => e.external_id),
    ).toEqual(['two'])
    // The read dropped the dangling index entry.
    expect(await socket!.zcard('polar_void:{org}:identity:alice')).toBe(1)
  })
})

describe.skipIf(!upstash)('redis over Upstash HTTP', () => {
  describeEventStorage('upstash', async () => {
    await upstash!.flushdb()
    return { storage: redisEventStorage(upstash!) }
  })

  it('issues exactly one script per operation', async () => {
    await upstash!.flushdb()
    const { connection, scripts } = counting(upstash!)
    const storage = redisEventStorage(connection)
    await storage.persist('org', [sample, { ...sample, external_id: 'two' }])
    await storage.reject('org', [sample])
    await storage.read('org', range)
    await storage.forget('org', ['two'])
    expect(scripts).toHaveLength(4)
  })
})
