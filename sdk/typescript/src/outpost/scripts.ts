export const READ_STATE_SCRIPT = `
if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[1], 'revision', '0')
end
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
-- An external_id Polar has not confirmed yet: tracking it again changes nothing.
if redis.call('HEXISTS', KEYS[2], ARGV[9]) == 1 then
    return reply()
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
redis.call('HSET', KEYS[2], ARGV[9], cjson.encode({ARGV[5], ARGV[6], ARGV[7], ARGV[8]}))
-- Events nobody confirms are forgotten an hour after the last write to their bucket.
redis.call('EXPIRE', KEYS[2], 3900)

if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
local update = reply()
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], bucket = update}))
return update
`;

export const CONFIRM_SCRIPT = `
local bucket = 'bucket:' .. ARGV[4] .. ':'
local pending = 'pending:' .. ARGV[4] .. ':'
local removed = 0
for i = 5, #ARGV do
    local raw = redis.call('HGET', KEYS[2], ARGV[i])
    if raw then
        local entry = cjson.decode(raw)
        redis.call('HDEL', KEYS[2], ARGV[i])
        redis.call('HINCRBY', KEYS[1], pending .. 'count', -tonumber(entry[1]))
        redis.call('HINCRBYFLOAT', KEYS[1], pending .. 'sum', -tonumber(entry[2]))
        removed = removed + 1
    end
end
if removed == 0 then
    return {}
end
local count = tonumber(redis.call('HGET', KEYS[1], pending .. 'count') or '0')
if count <= 0 then
    redis.call('HDEL', KEYS[1], pending .. 'count', pending .. 'sum', pending .. 'min', pending .. 'max')
    local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
    -- Polar counts the whole bucket once it is cold: the local copy has nothing left to add.
    if cutoff and tonumber(ARGV[4]) < tonumber(cutoff) then
        redis.call('HDEL', KEYS[1], bucket .. 'count', bucket .. 'sum', bucket .. 'min', bucket .. 'max')
    end
else
    -- Extrema cannot be decremented: read them off the events still pending.
    local min, max
    for _, raw in ipairs(redis.call('HVALS', KEYS[2])) do
        local entry = cjson.decode(raw)
        if entry[3] ~= '' then
            local value = tonumber(entry[3])
            if not min or value < min then min = value end
        end
        if entry[4] ~= '' then
            local value = tonumber(entry[4])
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
local fields = {'epoch', 'revision'}
for _, prefix in ipairs({bucket, pending}) do
    for _, statistic in ipairs({'count', 'sum', 'min', 'max'}) do
        table.insert(fields, prefix .. statistic)
    end
end
local values = redis.call('HMGET', KEYS[1], unpack(fields))
local update = {}
for i, field in ipairs(fields) do
    if values[i] then
        table.insert(update, field)
        table.insert(update, values[i])
    end
end
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], bucket = update}))
return update
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
    -- reported, and kept while events Polar has not confirmed remain pending in it, for an
    -- hour at most: its pending part is what the local read adds on top of Polar's totals.
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
                if kind == 'bucket' then
                    table.insert(replaced, field)
                    table.insert(replaced, value)
                end
                if sealed(start) then table.insert(dropped, field) end
            end
        end
    end
    for i = 1, #dropped, 1000 do
        redis.call('HDEL', KEYS[1], unpack(dropped, i, math.min(i + 999, #dropped)))
    end
    redis.call('HSET', KEYS[1], 'cold_until', ARGV[4], 'snapshot_version', ARGV[5],
        'cold:count', ARGV[8], 'cold:sum', ARGV[9])
    if ARGV[10] ~= '' then redis.call('HSET', KEYS[1], 'cold:min', ARGV[10]) end
    if ARGV[11] ~= '' then redis.call('HSET', KEYS[1], 'cold:max', ARGV[11]) end
end
local credit_version = fields['credited_version:' .. ARGV[6]]
if not credit_version or version >= tonumber(credit_version) then
    redis.call('HSET', KEYS[1], 'credited:' .. ARGV[6], ARGV[7],
        'credited_version:' .. ARGV[6], ARGV[5])
end

if not fields['epoch'] then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
state = redis.call('HGETALL', KEYS[1])
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], state = state}))
return {state, replaced}
`;
