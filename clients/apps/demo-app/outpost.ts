import Redis from 'ioredis'

export type OutpostState = {
  // Credits in the last snapshot Outpost pulled from Polar
  credits: number
  // Events counted in Polar's last snapshot
  settled: number
  // Events tracked since that snapshot, only counted in Redis so far
  pending: number
  // When Polar's snapshots will have settled every pending event
  pendingUntil: number
  snapshotAt: number
}

// Outpost counts events in 5-minute buckets, and Polar's snapshots only
// settle whole buckets
const BUCKET_US = 5 * 60 * 1000 * 1000

let redis: Redis | undefined

// Reads the same state the SDK's Outpost strategy keeps for this customer
export const readOutpost = async (
  externalId: string,
): Promise<OutpostState | null> => {
  const url = process.env.REDIS_URL
  if (!url) return null
  redis ??= new Redis(url)

  // Keyed by external ID, then by the organization the token belongs to
  let cursor = '0'
  let key: string | undefined
  do {
    let keys: string[]
    ;[cursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `outpost:state:external:${externalId}:*`,
    )
    key = keys[0]
  } while (!key && cursor !== '0')
  if (!key) return null

  const fields = await redis.hgetall(key)
  if (fields.cold_until === undefined) return null

  // Timestamps are microseconds
  const settledUntil = Number(fields.cold_until)
  let credits = 0
  let pending = 0
  let lastPendingBucket = settledUntil
  for (const [field, value] of Object.entries(fields)) {
    if (/^credited:[^:]+$/.test(field)) credits += Number(value)
    const bucket = /^bucket:(-?\d+):count$/.exec(field)
    // Older buckets are already counted in Polar's snapshot
    if (bucket && Number(bucket[1]) >= settledUntil && Number(value) > 0) {
      pending += Number(value)
      lastPendingBucket = Math.max(lastPendingBucket, Number(bucket[1]))
    }
  }

  return {
    credits,
    settled: Number(fields['cold:count'] ?? 0),
    pending,
    pendingUntil: Math.floor((lastPendingBucket + BUCKET_US) / 1000),
    snapshotAt: Math.floor(Number(fields.snapshot_version) / 1000),
  }
}
