export const READ_STATE_SCRIPT = `
if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[1], 'revision', '0')
end
return redis.call('HGETALL', KEYS[1])
`;

export const WRITE_BUCKET_SCRIPT = `
local cutoff = redis.call('HGET', KEYS[1], 'cold_until')
if cutoff and tonumber(ARGV[4]) < tonumber(cutoff) then
    return redis.call('HGETALL', KEYS[1])
end
local field, func, raw_value = ARGV[5], ARGV[6], ARGV[7]
if func == 'count' then
    redis.call('HINCRBY', KEYS[1], field, raw_value)
elseif func == 'sum' then
    redis.call('HINCRBYFLOAT', KEYS[1], field, raw_value)
else
    assert(func == 'min' or func == 'max', 'Unsupported aggregation')
    local value = tonumber(raw_value)
    assert(value and value == value and math.abs(value) ~= math.huge, 'Invalid value')
    local stored = redis.call('HGET', KEYS[1], field)
    local previous = stored and assert(tonumber(stored), 'Invalid stored value')
    if previous then
        assert(previous == previous and math.abs(previous) ~= math.huge, 'Invalid stored value')
    end
    if not previous or (func == 'min' and value < previous)
        or (func == 'max' and value > previous) then
        redis.call('HSET', KEYS[1], field, raw_value)
    end
end

if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
local state = redis.call('HGETALL', KEYS[1])
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], state = state}))
return state
`;

export const APPLY_SNAPSHOT_SCRIPT = `
local cutoff = tonumber(ARGV[4])
local current = redis.call('HGET', KEYS[1], 'cold_until')
if current and tonumber(current) > cutoff then
    return redis.call('HGETALL', KEYS[1])
end
for _, field in ipairs(redis.call('HKEYS', KEYS[1])) do
    if string.sub(field, 1, 5) == 'cold:' or string.sub(field, 1, 9) == 'credited:'
        or (string.sub(field, 1, 7) == 'bucket:'
            and tonumber(string.match(field, ':(%-?%d+)$')) < cutoff) then
        redis.call('HDEL', KEYS[1], field)
    end
end
redis.call('HSET', KEYS[1], 'cold_until', ARGV[4])
for i = 5, #ARGV, 2 do
    redis.call('HSET', KEYS[1], ARGV[i], ARGV[i + 1])
end

if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
local state = redis.call('HGETALL', KEYS[1])
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], state = state}))
return state
`;
