local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
if cutoff and tonumber(ARGV[4]) < tonumber(cutoff) then
    return {}
end
local prefix = 'bucket:' .. ARGV[4] .. ':'
local total = tonumber(redis.call('HGET', KEYS[1], prefix .. 'sum') or '0') + tonumber(ARGV[6])
assert(total == total and math.abs(total) ~= math.huge, 'Aggregation values must be finite')
redis.call('HINCRBYFLOAT', KEYS[1], prefix .. 'sum', ARGV[6])
redis.call('HINCRBY', KEYS[1], prefix .. 'count', ARGV[5])
for i, func in ipairs({'min', 'max'}) do
    local raw = ARGV[6 + i]
    if raw ~= '' then
        local value = tonumber(raw)
        assert(value and value == value and math.abs(value) ~= math.huge, 'Invalid value')
        local stored = redis.call('HGET', KEYS[1], prefix .. func)
        local previous = stored and tonumber(stored)
        if not previous or (func == 'min' and value < previous)
            or (func == 'max' and value > previous) then
            redis.call('HSET', KEYS[1], prefix .. func, raw)
        end
    end
end

if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
local fields = {'epoch', 'revision', prefix .. 'count', prefix .. 'sum', prefix .. 'min', prefix .. 'max'}
local values = redis.call('HMGET', KEYS[1], unpack(fields))
local bucket = {}
for i, field in ipairs(fields) do
    if values[i] then
        table.insert(bucket, field)
        table.insert(bucket, values[i])
    end
end
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], bucket = bucket}))
return bucket
