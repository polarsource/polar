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

type ReducerState = Record<string, string>

const coldSum = (state: ReducerState) => Number(state['cold:sum'] ?? 0)

// Outpost keeps one hash per customer and reducer without recording whether
// the reducer counts usage or credits. Credits only come from Polar, so a hash
// with local buckets is the usage one; otherwise credits carry the larger sum.
const splitReducers = (states: ReducerState[]) => {
  const bySum = [...states].sort((a, b) => coldSum(b) - coldSum(a))
  const usage =
    states.find((state) =>
      Object.keys(state).some((field) => field.startsWith('bucket:')),
    ) ?? bySum.at(-1)
  const credit = bySum.find((state) => state !== usage)
  return { usage, credit }
}

// Reads the same state the SDK's Outpost strategy keeps for this customer
export const readOutpost = async (
  externalId: string,
): Promise<OutpostState | null> => {
  const url = process.env.REDIS_URL
  if (!url) return null
  const client = (redis ??= new Redis(url))

  // One hash per reducer: outpost:v1:state:external:<id>:<reducer id>
  const keys: string[] = []
  let cursor = '0'
  do {
    let batch: string[]
    ;[cursor, batch] = await client.scan(
      cursor,
      'MATCH',
      `outpost:v1:state:external:${externalId}:*`,
    )
    keys.push(...batch)
  } while (cursor !== '0')

  const states = (
    await Promise.all(keys.map((key) => client.hgetall(key)))
  ).filter((fields) => fields.cold_until !== undefined)
  const { usage, credit } = splitReducers(states)
  if (!usage) return null

  // Timestamps are microseconds
  const settledUntil = Number(usage.cold_until)
  let pending = 0
  let lastPendingBucket = settledUntil
  for (const [field, value] of Object.entries(usage)) {
    const bucket = /^bucket:(-?\d+):count$/.exec(field)
    // Older buckets are already counted in Polar's snapshot
    if (bucket && Number(bucket[1]) >= settledUntil && Number(value) > 0) {
      pending += Number(value)
      lastPendingBucket = Math.max(lastPendingBucket, Number(bucket[1]))
    }
  }

  return {
    credits: credit ? coldSum(credit) : 0,
    settled: Number(usage['cold:count'] ?? 0),
    pending,
    pendingUntil: Math.floor((lastPendingBucket + BUCKET_US) / 1000),
    snapshotAt: Math.floor(Number(usage.snapshot_version) / 1000),
  }
}
