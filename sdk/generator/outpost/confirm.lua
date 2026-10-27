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
