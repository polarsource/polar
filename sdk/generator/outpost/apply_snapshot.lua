local cutoff = tonumber(ARGV[4])
local current = redis.call('HGET', KEYS[1], 'cold_until')
if current and tonumber(current) > cutoff then
    return {redis.call('HGETALL', KEYS[1]), {}}
end
local replaced = {}
local version = tonumber(ARGV[5])
local previous = redis.call('HGET', KEYS[1], 'snapshot_version')
if not previous or version >= tonumber(previous) then
    if current then replaced = {'cold_until', current} end
    for _, field in ipairs(redis.call('HKEYS', KEYS[1])) do
        if string.sub(field, 1, 5) == 'cold:'
            or (string.sub(field, 1, 7) == 'bucket:'
                and tonumber(string.match(field, '^bucket:(%-?%d+):')) < cutoff) then
            table.insert(replaced, field)
            table.insert(replaced, redis.call('HGET', KEYS[1], field))
            redis.call('HDEL', KEYS[1], field)
        end
    end
    redis.call('HSET', KEYS[1], 'cold_until', ARGV[4], 'snapshot_version', ARGV[5],
        'cold:count', ARGV[8], 'cold:sum', ARGV[9])
    if ARGV[10] ~= '' then redis.call('HSET', KEYS[1], 'cold:min', ARGV[10]) end
    if ARGV[11] ~= '' then redis.call('HSET', KEYS[1], 'cold:max', ARGV[11]) end
end
local credit_version = redis.call('HGET', KEYS[1], 'credited_version:' .. ARGV[6])
if not credit_version or version >= tonumber(credit_version) then
    redis.call('HSET', KEYS[1], 'credited:' .. ARGV[6], ARGV[7],
        'credited_version:' .. ARGV[6], ARGV[5])
end

if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[3], 'revision', '0')
end
redis.call('HINCRBY', KEYS[1], 'revision', 1)
local state = redis.call('HGETALL', KEYS[1])
redis.call('PUBLISH', ARGV[2], cjson.encode({customer = ARGV[1], state = state}))
return {state, replaced}
