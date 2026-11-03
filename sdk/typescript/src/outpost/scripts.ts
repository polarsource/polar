export const READ_STATE_SCRIPT = `
if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[1], 'revision', '0')
end
redis.call('EXPIRE', KEYS[1], 86400)
return redis.call('HGETALL', KEYS[1])
`;

export const WRITE_BUCKET_SCRIPT = `
local bucket = 'bucket:' .. ARGV[4] .. ':'
local pending = 'pending:' .. ARGV[4] .. ':'
local fields = {'epoch', 'revision'}
for _, prefix in ipairs({bucket, pending}) do
    for _, statistic in ipairs({'count', 'sum', 'min', 'max'}) do
        table.insert(fields, prefix .. statistic)
    end
end
local function reply()
    local values = redis.call('HMGET', KEYS[1], unpack(fields))
    local update = {}
    for i, field in ipairs(fields) do
        if values[i] then
            table.insert(update, field)
            table.insert(update, values[i])
        end
    end
    return update
end
local total = tonumber(redis.call('HGET', KEYS[1], bucket .. 'sum') or '0') + tonumber(ARGV[6])
assert(total == total and math.abs(total) ~= math.huge, 'Aggregation values must be finite')
for i, func in ipairs({'min', 'max'}) do
    local raw = ARGV[6 + i]
    if raw ~= '' then
        local value = tonumber(raw)
        assert(value and value == value and math.abs(value) ~= math.huge, 'Invalid value')
    end
end
-- One event pending: its value, or nothing when it only counts. An external_id Polar has not
-- confirmed yet: tracking it again changes nothing.
assert(ARGV[5] == '1', 'One event per write')
local entry = ARGV[7] ~= '' and ARGV[6] or ''
if redis.call('HSETNX', KEYS[2], ARGV[9], entry) == 0 then
    return reply()
end
-- Every local event counts in its bucket; the pending part is what Polar has not confirmed.
for _, prefix in ipairs({bucket, pending}) do
    redis.call('HINCRBYFLOAT', KEYS[1], prefix .. 'sum', ARGV[6])
    redis.call('HINCRBY', KEYS[1], prefix .. 'count', ARGV[5])
    for i, func in ipairs({'min', 'max'}) do
        local raw = ARGV[6 + i]
        if raw ~= '' then
            local value = tonumber(raw)
            local stored = redis.call('HGET', KEYS[1], prefix .. func)
            local previous = stored and tonumber(stored)
            if not previous or (func == 'min' and value < previous)
                or (func == 'max' and value > previous) then
                redis.call('HSET', KEYS[1], prefix .. func, raw)
            end
        end
    end
end
-- Events nobody confirms are forgotten an hour after the last write to their bucket. A state
-- nobody reads, writes or snapshots for a day is forgotten too: the next read rebuilds it from
-- Polar's snapshot.
redis.call('EXPIRE', KEYS[2], 3900)

if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
redis.call('EXPIRE', KEYS[1], 86400)
local update = reply()
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], bucket = update}))
return update
`;

export const CONFIRM_SCRIPT = `
local bucket = 'bucket:' .. ARGV[4] .. ':'
local pending = 'pending:' .. ARGV[4] .. ':'
local BATCH = 1000
-- Polar received the events but no snapshot counts them yet: a cold bucket keeps them
-- pending for the snapshot that will, a hot one counts them whole either way.
if ARGV[5] == '1' then
    local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
    if cutoff and tonumber(ARGV[4]) < tonumber(cutoff) then
        return {}
    end
end
local ids = {}
for i = 6, #ARGV do table.insert(ids, ARGV[i]) end
local gone, seen = {}, {}
local removed, sum = 0, 0
local current = redis.call('HMGET', KEYS[1], pending .. 'min', pending .. 'max')
local min, max = tonumber(current[1]), tonumber(current[2])
local extremum = false
-- An entry is the event's value, or nothing when it only counts. Earlier SDK versions stored
-- the event's count, sum, min and max as a JSON array; their entries expire within the hour.
local function value_of(entry)
    if entry:sub(1, 1) == '[' then
        local legacy = cjson.decode(entry)
        entry = legacy[3] ~= '' and legacy[2] or ''
    end
    return entry ~= '' and tonumber(entry) or nil
end
for offset = 1, #ids, BATCH do
    local last = math.min(offset + BATCH - 1, #ids)
    local entries = redis.call('HMGET', KEYS[2], unpack(ids, offset, last))
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
    return {}
end
for offset = 1, #gone, BATCH do
    redis.call('HDEL', KEYS[2], unpack(gone, offset, math.min(offset + BATCH - 1, #gone)))
end
local count = tonumber(redis.call('HINCRBY', KEYS[1], pending .. 'count', -removed))
redis.call('HINCRBYFLOAT', KEYS[1], pending .. 'sum', -sum)
if count <= 0 then
    redis.call('HDEL', KEYS[1], pending .. 'count', pending .. 'sum', pending .. 'min', pending .. 'max')
    local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
    -- Polar counts the whole bucket once it is cold: the local copy has nothing left to add.
    if cutoff and tonumber(ARGV[4]) < tonumber(cutoff) then
        redis.call('HDEL', KEYS[1], bucket .. 'count', bucket .. 'sum', bucket .. 'min', bucket .. 'max')
    end
elseif extremum then
    -- Extrema cannot be decremented: read them off the events still pending.
    min, max = nil, nil
    for _, entry in ipairs(redis.call('HVALS', KEYS[2])) do
        local value = value_of(entry)
        if value then
            if not min or value < min then min = value end
            if not max or value > max then max = value end
        end
    end
    for func, value in pairs({min = min, max = max}) do
        redis.call('HSET', KEYS[1], pending .. func, tostring(value))
    end
    if not min then redis.call('HDEL', KEYS[1], pending .. 'min') end
    if not max then redis.call('HDEL', KEYS[1], pending .. 'max') end
end

if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
redis.call('EXPIRE', KEYS[1], 86400)
-- A confirmation can drop a bucket, which a bucket update cannot express: send the whole state.
local state = redis.call('HGETALL', KEYS[1])
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], state = state}))
return state
`;

export const APPLY_SNAPSHOT_SCRIPT = `
local cutoff = tonumber(ARGV[4])
local state = redis.call('HGETALL', KEYS[1])
local fields = {}
for i = 1, #state, 2 do fields[state[i]] = state[i + 1] end
local current = fields['cold_until']
if current and tonumber(current) > cutoff then
    return {state, {}}
end
local replaced = {}
local version = tonumber(ARGV[5])
local previous = fields['snapshot_version']
if not previous or version >= tonumber(previous) then
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
                if sealed(start) then table.insert(dropped, field) end
            end
        end
    end
    for i = 1, #dropped, 1000 do
        redis.call('HDEL', KEYS[1], unpack(dropped, i, math.min(i + 999, #dropped)))
    end
    redis.call('HSET', KEYS[1], 'cold_until', ARGV[4], 'snapshot_version', ARGV[5],
        'cold:count', ARGV[6], 'cold:sum', ARGV[7])
    if ARGV[8] ~= '' then redis.call('HSET', KEYS[1], 'cold:min', ARGV[8]) end
    if ARGV[9] ~= '' then redis.call('HSET', KEYS[1], 'cold:max', ARGV[9]) end
end
if not fields['epoch'] then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
redis.call('EXPIRE', KEYS[1], 86400)
state = redis.call('HGETALL', KEYS[1])
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], state = state}))
return {state, replaced}
`;
