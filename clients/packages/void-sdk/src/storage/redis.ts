import { Schema } from 'effect'
import { EventCreate } from '../api/generated'
import type { EventStorage, StoredEvent } from './storage'

/**
 * Anything that runs a Lua script as `eval(script, keys, args)`. Upstash's
 * `Redis` fits as it is; ioredis fits through its variadic `eval`, which the
 * adapter detects. Other clients adapt in one line, for example node-redis:
 * `{ eval: (script, keys, args) => client.eval(script, { keys, arguments: args }) }`.
 */
export interface RedisConnection {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>
}

/** An ioredis client: `eval(script, numberOfKeys, ...keys, ...args)`. */
export interface IORedisConnection {
  defineCommand(name: string, definition: unknown): unknown
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>
}

export interface RedisEventStorage extends EventStorage {
  readonly type: 'redis'
}

// Every operation is one EVAL, so the adapter needs no transaction primitive
// and works over one-shot HTTP clients and socket clients alike. Scripts are
// what make the conditional steps atomic: an index entry is only written for
// the copy that won `SET NX`, and pruning reads expired ids before deleting them.

// Keys, all under one hash tag so a cluster keeps an organization on one slot:
//   {prefix}event:<id>            JSON of the stored event
//   {prefix}identity:<identity>   zset of ids scored by event time
//   {prefix}recorded              zset of ids scored by recording time
//   {prefix}rejected              zset of ids scored by rejection time
const keysOf = (organizationId: string) => {
  const prefix = `polar_void:{${organizationId}}:`
  return { prefix, keys: [`${prefix}recorded`, `${prefix}rejected`] }
}

// Drops one id from every structure. Identity comes from the stored JSON, so
// no second copy of it has to be kept in sync.
const unindex = `
local function unindex(id)
  local key = prefix .. 'event:' .. id
  local json = redis.call('GET', key)
  if json then
    local identity = cjson.decode(json).external_identity_id
    if type(identity) == 'string' then
      redis.call('ZREM', prefix .. 'identity:' .. identity, id)
    end
    redis.call('DEL', key)
  end
  redis.call('ZREM', recorded, id)
  redis.call('ZREM', rejected, id)
end
`

// ARGV: prefix, now, pruneBefore or '', ttl or '', then (id, timestamp, json) per event.
// Times are epoch milliseconds. An empty ttl leaves keys without expiry.
const persistScript = `
local recorded, rejected = KEYS[1], KEYS[2]
local prefix, now, cutoff, ttl = ARGV[1], ARGV[2], ARGV[3], ARGV[4]
${unindex}
if cutoff ~= '' then
  for _, id in ipairs(redis.call('ZRANGEBYSCORE', recorded, '-inf', '(' .. cutoff)) do
    unindex(id)
  end
  redis.call('ZREMRANGEBYSCORE', rejected, '-inf', '(' .. cutoff)
end
local result = {}
for i = 5, #ARGV, 3 do
  local id, timestamp, json = ARGV[i], ARGV[i + 1], ARGV[i + 2]
  local key = prefix .. 'event:' .. id
  redis.call('ZREM', rejected, id)
  local won
  if ttl ~= '' then
    won = redis.call('SET', key, json, 'NX', 'PX', ttl)
  else
    won = redis.call('SET', key, json, 'NX')
  end
  if won then
    redis.call('ZADD', recorded, now, id)
    local identity = cjson.decode(json).external_identity_id
    if type(identity) == 'string' then
      local index = prefix .. 'identity:' .. identity
      redis.call('ZADD', index, timestamp, id)
      if ttl ~= '' then redis.call('PEXPIRE', index, ttl) end
    end
  end
  result[#result + 1] = redis.call('GET', key)
end
if ttl ~= '' then
  redis.call('PEXPIRE', recorded, ttl)
  redis.call('PEXPIRE', rejected, ttl)
end
return result
`

// ARGV: now, then ids. NX keeps the first rejection time.
const rejectScript = `
for i = 2, #ARGV do
  redis.call('ZADD', KEYS[2], 'NX', ARGV[1], ARGV[i])
end
return #ARGV - 1
`

// ARGV: prefix, then ids.
const forgetScript = `
local recorded, rejected = KEYS[1], KEYS[2]
local prefix = ARGV[1]
${unindex}
for i = 2, #ARGV do unindex(ARGV[i]) end
return #ARGV - 1
`

// ARGV: prefix, since or '-inf', until, recordedSince or '-inf', identities as JSON.
// Returns the stored JSON strings. An id whose key expired ahead of its index
// entry is skipped and dropped from that index. Names and order are handled by
// the caller.
const readScript = `
local recorded, rejected = KEYS[1], KEYS[2]
local prefix, since, upper, recordedSince = ARGV[1], ARGV[2], ARGV[3], ARGV[4]
local seen, result = {}, {}
for _, identity in ipairs(cjson.decode(ARGV[5])) do
  local index = prefix .. 'identity:' .. identity
  for _, id in ipairs(redis.call('ZRANGEBYSCORE', index, since, upper)) do
    if not seen[id] then
      seen[id] = true
      local keep = not redis.call('ZSCORE', rejected, id)
      if keep and recordedSince ~= '-inf' then
        local at = redis.call('ZSCORE', recorded, id)
        keep = at and tonumber(at) >= tonumber(recordedSince)
      end
      if keep then
        local json = redis.call('GET', prefix .. 'event:' .. id)
        if json then
          result[#result + 1] = json
        else
          redis.call('ZREM', index, id)
        end
      end
    end
  end
end
return result
`

const decodeEvent = Schema.decodeUnknownSync(EventCreate)

/**
 * Shared ledger in Redis, made for serverless: one Lua script per operation,
 * over Upstash's HTTP client or a socket client. Event keys expire after the
 * retention implied by `pruneBefore`, and each write also prunes the
 * organization's expired index entries, so memory stays bounded either way.
 */
export function redisEventStorage(
  connection: RedisConnection | IORedisConnection,
): RedisEventStorage {
  const run = evalOf(connection)
  return {
    type: 'redis',
    async persist(organizationId, events, { pruneBefore } = {}) {
      const { prefix, keys } = keysOf(organizationId)
      const now = Date.now()
      const recordedAt = new Date(now).toISOString()
      // Validate the whole batch before the call, so a failure stores nothing.
      const args = events.flatMap((event) => {
        const at = new Date(event.timestamp)
        if (Number.isNaN(at.getTime()))
          throw new Error(`void: invalid timestamp for ${event.external_id}`)
        const stored: StoredEvent = {
          ...event,
          timestamp: at.toISOString(),
          organization_id: organizationId,
          recorded_at: recordedAt,
        }
        return [event.external_id, String(at.getTime()), JSON.stringify(stored)]
      })
      // pruneBefore arrives as now minus retention, so their distance is the retention.
      const ttl = pruneBefore ? now - pruneBefore.getTime() : 0
      const result = await run(persistScript, keys, [
        prefix,
        String(now),
        pruneBefore ? String(pruneBefore.getTime()) : '',
        ttl > 0 ? String(ttl) : '',
        ...args,
      ])
      if (!Array.isArray(result) || result.length !== events.length)
        throw new Error('void: persisted event is missing')
      return result.map((value) => {
        const {
          organization_id: _org,
          recorded_at: _at,
          ...copy
        } = decode(value)
        return copy
      })
    },
    async reject(organizationId, events) {
      const { keys } = keysOf(organizationId)
      await run(rejectScript, keys, [
        String(Date.now()),
        ...events.map((event) => event.external_id),
      ])
    },
    async forget(organizationId, externalIds) {
      if (!externalIds.length) return
      const { prefix, keys } = keysOf(organizationId)
      await run(forgetScript, keys, [prefix, ...externalIds])
    },
    async read(
      organizationId,
      { names, identities, since, until, recordedSince },
    ) {
      if (!names.length || !identities.length) return []
      const { prefix, keys } = keysOf(organizationId)
      const result = await run(readScript, keys, [
        prefix,
        since === null ? '-inf' : String(since.getTime()),
        String(until.getTime()),
        recordedSince === null ? '-inf' : String(recordedSince.getTime()),
        JSON.stringify(identities),
      ])
      if (!Array.isArray(result))
        throw new Error('void: stored event is malformed')
      return result
        .map(decode)
        .filter((event) => names.includes(event.name))
        .sort(
          (a, b) =>
            compare(a.timestamp, b.timestamp) ||
            compare(a.external_id, b.external_id),
        )
    },
  }
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function evalOf(connection: RedisConnection | IORedisConnection) {
  return (script: string, keys: string[], args: string[]): Promise<unknown> =>
    'defineCommand' in connection
      ? connection.eval(script, keys.length, ...keys, ...args)
      : connection.eval(script, keys, args)
}

// Upstash parses JSON results on the way back; socket clients return strings. Accept both.
function decode(value: unknown): StoredEvent {
  const row: unknown = typeof value === 'string' ? JSON.parse(value) : value
  if (!row || typeof row !== 'object')
    throw new Error('void: stored event is malformed')
  const { organization_id, recorded_at, ...rest } = row as Record<
    string,
    unknown
  >
  if (typeof organization_id !== 'string' || typeof recorded_at !== 'string')
    throw new Error('void: stored event is malformed')
  const event = decodeEvent(rest)
  return {
    ...event,
    timestamp: new Date(event.timestamp!).toISOString(),
    external_identity_id: event.external_identity_id ?? null,
    metadata: event.metadata ?? {},
    organization_id,
    recorded_at,
  }
}
