export const READ_STATES_SCRIPT = `
-- A customer's read in one command: for each reducer, KEYS holds its state and its missing marker,
-- and the last key is the pull. ARGV names, per reducer, the statistics the reader adds up,
-- comma-separated, or none for its readiness alone. A state keeps cold_until, reset and those
-- statistics of the groups the read counts: the cold totals, the pending part of cold buckets,
-- the hot buckets. Values go back as stored; the reader adds them up.
local reads = {}
for i = 1, #ARGV do
    local state = KEYS[2 * i - 1]
    redis.call('EXPIRE', state, 86400)
    local fields = redis.call('HGETALL', state)
    local wanted = {}
    for statistic in string.gmatch(ARGV[i], '[^,]+') do
        wanted[statistic] = true
    end
    local cold_until
    for j = 1, #fields, 2 do
        if fields[j] == 'cold_until' then
            cold_until = tonumber(fields[j + 1])
        end
    end
    local kept = {}
    for j = 1, #fields, 2 do
        local field = fields[j]
        local keep = field == 'cold_until' or field == 'reset'
        local group, statistic = string.match(field, '^(.+):(%a+)$')
        if not keep and group and wanted[statistic] then
            if group == 'cold' then
                keep = true
            else
                local kind, start = string.match(group, '^(%a+):(%-?%d+)$')
                start = tonumber(start)
                if kind == 'bucket' then
                    keep = cold_until == nil or start >= cold_until
                elseif kind == 'pending' then
                    keep = cold_until ~= nil and start < cold_until
                end
            end
        end
        if keep then
            kept[#kept + 1] = field
            kept[#kept + 1] = fields[j + 1]
        end
    end
    reads[i] = {redis.call('HGET', KEYS[2 * i], 'retry_at'), kept}
end
reads[#ARGV + 1] = redis.call('HGET', KEYS[#KEYS], 'reset')
return reads
`;

export const PREPARE_SNAPSHOT_SCRIPT = `
-- What a snapshot needs before it applies, in one command. KEYS are the state and the missing
-- marker; ARGV[1] is '1' for a pulled snapshot, ARGV[2] its cold_until. A pulled snapshot of a
-- state Redis does not hold goes no further: false. Otherwise the customer is known again, and
-- the reply is the start of each bucket the snapshot seals that still holds pending events.
if ARGV[1] == '1' and redis.call('EXISTS', KEYS[1]) == 0 then
    return false
end
redis.call('DEL', KEYS[2])
local cold_until = tonumber(ARGV[2])
local sealed = {}
local fields = redis.call('HGETALL', KEYS[1])
for i = 1, #fields, 2 do
    local start = string.match(fields[i], '^pending:(%-?%d+):count$')
    if start and tonumber(start) < cold_until and tonumber(fields[i + 1]) > 0 then
        sealed[#sealed + 1] = start
    end
end
return sealed
`;

export const PUSH_TELEMETRY_SCRIPT = `
-- An instance's exports in one command. KEYS are the spans and the metrics lists; ARGV[1] is how
-- many exports each list keeps, the newest; ARGV[2] how many of the values after it are spans,
-- the rest being metrics.
local spans = tonumber(ARGV[2])
local ranges = {{3, 2 + spans}, {3 + spans, #ARGV}}
for i, key in ipairs(KEYS) do
    local first, last = ranges[i][1], ranges[i][2]
    if last >= first then
        redis.call('RPUSH', key, unpack(ARGV, first, last))
        redis.call('LTRIM', key, -tonumber(ARGV[1]), -1)
    end
end
return 1
`;

export const WRITE_BUCKET_SCRIPT = `
local bucket = 'bucket:' .. ARGV[1] .. ':'
local pending = 'pending:' .. ARGV[1] .. ':'
-- ARGV[2] is the event's value, or nothing when it only counts.
local value = ARGV[2] ~= '' and tonumber(ARGV[2]) or nil
assert(ARGV[2] == '' or (value and value == value and math.abs(value) ~= math.huge), 'Invalid value')
local total = tonumber(redis.call('HGET', KEYS[1], bucket .. 'sum') or '0') + (value or 0)
assert(total == total and math.abs(total) ~= math.huge, 'Aggregation values must be finite')
-- One event pending, under its external_id, ARGV[3]. An external_id Polar has not confirmed yet:
-- tracking it again changes nothing.
if redis.call('HSETNX', KEYS[2], ARGV[3], ARGV[2]) == 0 then
    return 0
end
-- The write that first sees an event queues it for Polar, as Polar ingests it: KEYS[3] is the
-- stream, ARGV[4] the event, or nothing for the other reducers the event matches. A flusher
-- holding the first slot, KEYS[4], reads the stream again once it lets go: it delivers the event.
-- Otherwise the write returns 2, and the instance drains the stream on its next flush.
local written = 1
if ARGV[4] ~= '' then
    redis.call('XADD', KEYS[3], '*', 'event', ARGV[4])
    if redis.call('EXISTS', KEYS[4]) == 0 then
        written = 2
    end
end
-- Every local event counts in its bucket; the pending part is what Polar has not confirmed.
for _, prefix in ipairs({bucket, pending}) do
    redis.call('HINCRBYFLOAT', KEYS[1], prefix .. 'sum', value and ARGV[2] or '0')
    redis.call('HINCRBY', KEYS[1], prefix .. 'count', 1)
    if value then
        for _, func in ipairs({'min', 'max'}) do
            local stored = redis.call('HGET', KEYS[1], prefix .. func)
            local previous = stored and tonumber(stored)
            if not previous or (func == 'min' and value < previous)
                or (func == 'max' and value > previous) then
                redis.call('HSET', KEYS[1], prefix .. func, ARGV[2])
            end
        end
    end
end
-- Events nobody confirms are forgotten an hour after the last write to their bucket. A state
-- nobody reads, writes or snapshots for a day is forgotten too: the next read rebuilds it from
-- Polar's snapshot.
redis.call('EXPIRE', KEYS[2], 3900)
redis.call('EXPIRE', KEYS[1], 86400)
return written
`;

export const CONFIRM_SCRIPT = `
-- Settles groups of events, one per (state, bucket), and acknowledges the outbox entries that
-- carried them. KEYS[1] is the outbox, KEYS[2] the lock of the flusher that delivered them, then
-- each group's state and pending hash in turn. ARGV[1] is the hot-only flag, ARGV[2] and ARGV[3]
-- the lock's token and TTL, ARGV[4] the number of entries, then the entries; then each group
-- gives its bucket start, its number of ids and the ids.
local BATCH = 1000
-- An entry is the event's value, or nothing when it only counts.
local function value_of(entry)
    return entry ~= '' and tonumber(entry) or nil
end
local function settle(state, pending_key, start, ids)
    local bucket = 'bucket:' .. start .. ':'
    local pending = 'pending:' .. start .. ':'
    -- Polar received the events but no snapshot counts them yet: a cold bucket keeps them
    -- pending for the snapshot that will, a hot one counts them whole either way.
    if ARGV[1] == '1' then
        local cutoff = redis.call('HGET', state, 'cold_until')
        if cutoff and tonumber(start) < tonumber(cutoff) then
            return 0
        end
    end
    local gone, seen = {}, {}
    local removed, sum = 0, 0
    local current = redis.call('HMGET', state, pending .. 'min', pending .. 'max')
    local min, max = tonumber(current[1]), tonumber(current[2])
    local extremum = false
    for offset = 1, #ids, BATCH do
        local last = math.min(offset + BATCH - 1, #ids)
        local entries = redis.call('HMGET', pending_key, unpack(ids, offset, last))
        for i, entry in ipairs(entries) do
            local id = ids[offset + i - 1]
            if entry and not seen[id] then
                seen[id] = true
                table.insert(gone, id)
                removed = removed + 1
                local value = value_of(entry)
                if value then
                    sum = sum + value
                    if value == min or value == max then extremum = true end
                end
            end
        end
    end
    if removed == 0 then
        return 0
    end
    for offset = 1, #gone, BATCH do
        redis.call('HDEL', pending_key, unpack(gone, offset, math.min(offset + BATCH - 1, #gone)))
    end
    local count = tonumber(redis.call('HINCRBY', state, pending .. 'count', -removed))
    redis.call('HINCRBYFLOAT', state, pending .. 'sum', -sum)
    if count <= 0 then
        redis.call('HDEL', state, pending .. 'count', pending .. 'sum', pending .. 'min', pending .. 'max')
        local cutoff = redis.call('HGET', state, 'cold_until')
        -- Polar counts the whole bucket once it is cold: the local copy has nothing left to add.
        if cutoff and tonumber(start) < tonumber(cutoff) then
            redis.call('HDEL', state, bucket .. 'count', bucket .. 'sum', bucket .. 'min', bucket .. 'max')
        end
    elseif extremum then
        -- Extrema cannot be decremented: read them off the events still pending.
        min, max = nil, nil
        for _, entry in ipairs(redis.call('HVALS', pending_key)) do
            local value = value_of(entry)
            if value then
                if not min or value < min then min = value end
                if not max or value > max then max = value end
            end
        end
        for func, value in pairs({min = min, max = max}) do
            redis.call('HSET', state, pending .. func, tostring(value))
        end
        if not min then redis.call('HDEL', state, pending .. 'min') end
        if not max then redis.call('HDEL', state, pending .. 'max') end
    end
    redis.call('EXPIRE', state, 86400)
    return removed
end
local entries = tonumber(ARGV[4])
if entries > 0 then
    local ids = {}
    for i = 5, 4 + entries do table.insert(ids, ARGV[i]) end
    for offset = 1, #ids, BATCH do
        local batch = {unpack(ids, offset, math.min(offset + BATCH - 1, #ids))}
        redis.call('XACK', KEYS[1], 'polar', unpack(batch))
        redis.call('XDEL', KEYS[1], unpack(batch))
    end
    -- The flusher holds its slot through the next batch.
    if redis.call('GET', KEYS[2]) == ARGV[2] then
        redis.call('PEXPIRE', KEYS[2], ARGV[3])
    end
end
local removed, cursor = 0, 5 + entries
for group = 1, (#KEYS - 2) / 2 do
    local start, count = ARGV[cursor], tonumber(ARGV[cursor + 1])
    local ids = {}
    for i = cursor + 2, cursor + 1 + count do table.insert(ids, ARGV[i]) end
    removed = removed + settle(KEYS[2 * group + 1], KEYS[2 * group + 2], start, ids)
    cursor = cursor + 2 + count
end
return removed
`;

export const OUTBOX_BACKLOG_SCRIPT = `
-- The outbox's length, how many of its entries flushers hold, and when the fleet may send it
-- again after Polar failed: KEYS[1] is the outbox, KEYS[2] its backoff, ARGV[1] the consumer group.
-- ARGV[2], optional, is the retry the caller read before it delivered: Polar takes batches
-- again, so that backoff ends, unless a flusher failed since and set a later one.
if ARGV[2] and redis.call('HGET', KEYS[2], 'retry_at') == ARGV[2] then
    redis.call('DEL', KEYS[2])
end
local retry_at = redis.call('HGET', KEYS[2], 'retry_at') or ''
local length = redis.call('XLEN', KEYS[1])
if length == 0 then
    return {0, 0, retry_at}
end
return {length, redis.call('XPENDING', KEYS[1], ARGV[1])[1], retry_at}
`;

export const RELEASE_LOCK_SCRIPT = `
-- Deletes the lock, if it still holds this instance's token: once the lock expired, another
-- instance may hold it.
local lock = KEYS[1]
local token = ARGV[1]

if redis.call('GET', lock) == token then
    return redis.call('DEL', lock)
end
return 0
`;

export const EXTEND_LOCK_SCRIPT = `
-- Keeps the lock for another ttl milliseconds, if it still holds this instance's token.
local lock = KEYS[1]
local token = ARGV[1]
local ttl = ARGV[2]

if redis.call('GET', lock) == token then
    return redis.call('PEXPIRE', lock, ttl)
end
return 0
`;

export const COMMIT_PULL_SCRIPT = `
-- Saves the cursor once a page of changes is applied. Returns 0 and saves nothing when this
-- instance no longer holds the pull lock: once the lock expired, another instance may pull.
local pull = KEYS[1]
local lock = KEYS[2]
local token = ARGV[1]
local cursor = ARGV[2]
local pulled_at = ARGV[3]
local next_poll_in = ARGV[4]
-- '1' on the last page: the pull is over and the lock goes.
local last_page = ARGV[5] == '1'

if redis.call('GET', lock) ~= token then
    return 0
end
redis.call('HSET', pull, 'cursor', cursor, 'pulled_at', pulled_at, 'next_poll_in', next_poll_in)
-- A pull that succeeds ends the backoff.
redis.call('HDEL', pull, 'failures', 'retry_at')
if last_page then
    redis.call('DEL', lock)
end
return 1
`;

export const BACKOFF_SCRIPT = `
-- Counts one more failure in a row on a key the whole fleet shares, such as the pull's, and
-- says when to try again. Each failure in a row doubles the wait, up to a maximum. Failures
-- met during one wait count as one: they only move the retry later, never sooner.
local key = KEYS[1]
local now = tonumber(ARGV[1])
local first_delay = tonumber(ARGV[2])
local max_delay = tonumber(ARGV[3])
-- Optional: the key expires this many milliseconds later, and its failures with it.
local forget_after = ARGV[4]

local waiting_until = tonumber(redis.call('HGET', key, 'retry_at')) or 0
local failures = waiting_until > now and tonumber(redis.call('HGET', key, 'failures'))
    or redis.call('HINCRBY', key, 'failures', 1)
local delay = math.min(max_delay, first_delay * 2 ^ math.min(failures - 1, 16))
local retry_at = math.max(waiting_until, now + delay)
redis.call('HSET', key, 'retry_at', retry_at)
if forget_after then
    redis.call('PEXPIRE', key, forget_after)
end
return retry_at
`;

export const APPLY_SNAPSHOT_SCRIPT = `
local cutoff = tonumber(ARGV[1])
local state = redis.call('HGETALL', KEYS[1])
local fields = {}
for i = 1, #state, 2 do fields[state[i]] = state[i + 1] end
-- The pull's reset count when Polar answered: a read after the next reset asks Polar again.
-- Recorded even for an older snapshot it rejects: Redis then holds a newer one than Polar's answer.
if ARGV[7] and fields['reset'] ~= ARGV[7] then
    if ARGV[7] == '' then
        redis.call('HDEL', KEYS[1], 'reset')
    else
        redis.call('HSET', KEYS[1], 'reset', ARGV[7])
    end
end
local current = fields['cold_until']
local previous = fields['snapshot_version']
-- Polar sends each snapshot to every instance: an older one changes nothing.
if (current and tonumber(current) > cutoff)
    or (previous and tonumber(ARGV[2]) < tonumber(previous)) then
    return {}
end
local replaced = {}
if current then replaced = {'cold_until', current} end
-- Polar's totals now cover the buckets before the cutoff. The local copy of each is
-- reported with its pending part, and kept while events Polar has not confirmed remain
-- pending in it, for an hour at most: that pending part is what the local read adds on
-- top of Polar's totals.
local function sealed(start)
    local pending = fields['pending:' .. start .. ':count']
    return not pending or tonumber(pending) <= 0 or tonumber(start) + 3600000000 < cutoff
end
local dropped = {}
local seals = false
for field, value in pairs(fields) do
    if string.sub(field, 1, 5) == 'cold:' then
        table.insert(replaced, field)
        table.insert(replaced, value)
        table.insert(dropped, field)
    else
        local kind, start = string.match(field, '^(%a+):(%-?%d+):')
        if (kind == 'bucket' or kind == 'pending') and tonumber(start) < cutoff then
            table.insert(replaced, field)
            table.insert(replaced, value)
            if sealed(start) then
                table.insert(dropped, field)
                seals = true
            end
        end
    end
end
-- Numbers, not strings: SDKs in other languages may format the same value differently.
local function stored(field, value)
    if value == '' then return fields[field] == nil end
    return fields[field] ~= nil and tonumber(fields[field]) == tonumber(value)
end
-- The snapshot another instance applied: nothing to write.
if not seals and stored('cold_until', ARGV[1]) and stored('cold:count', ARGV[3])
    and stored('cold:sum', ARGV[4]) and stored('cold:min', ARGV[5])
    and stored('cold:max', ARGV[6]) then
    redis.call('HSET', KEYS[1], 'snapshot_version', ARGV[2])
    redis.call('EXPIRE', KEYS[1], 86400)
    return {}
end
for i = 1, #dropped, 1000 do
    redis.call('HDEL', KEYS[1], unpack(dropped, i, math.min(i + 999, #dropped)))
end
redis.call('HSET', KEYS[1], 'cold_until', ARGV[1], 'snapshot_version', ARGV[2],
    'cold:count', ARGV[3], 'cold:sum', ARGV[4])
if ARGV[5] ~= '' then redis.call('HSET', KEYS[1], 'cold:min', ARGV[5]) end
if ARGV[6] ~= '' then redis.call('HSET', KEYS[1], 'cold:max', ARGV[6]) end
redis.call('EXPIRE', KEYS[1], 86400)
return replaced
`;
