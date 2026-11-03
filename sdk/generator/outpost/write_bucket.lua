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
