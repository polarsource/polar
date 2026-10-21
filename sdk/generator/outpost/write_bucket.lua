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
