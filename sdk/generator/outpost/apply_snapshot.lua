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
