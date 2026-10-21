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
