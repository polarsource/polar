-- Settles groups of events, one per (state, bucket), and acknowledges the outbox entries that
-- carried them. KEYS[1] is the outbox, KEYS[2] the lock of the flusher that delivered them, then
-- each group's state and pending hash in turn. ARGV[1] is the hot-only flag, ARGV[2] and ARGV[3]
-- the lock's token and TTL, ARGV[4] the number of entries, then the entries; then each group
-- gives its bucket start, its number of ids and the ids.
local BATCH = 1000
-- An entry is the event's value, or nothing when it only counts.
local function value_of(entry)
    return entry ~= '' and tonumber(entry) or nil
end
local function settle(state, pending_key, start, ids)
    local bucket = 'bucket:' .. start .. ':'
    local pending = 'pending:' .. start .. ':'
    -- Polar received the events but no snapshot counts them yet: a cold bucket keeps them
    -- pending for the snapshot that will, a hot one counts them whole either way.
    if ARGV[1] == '1' then
        local cutoff = redis.call('HGET', state, 'cold_until')
        if cutoff and tonumber(start) < tonumber(cutoff) then
            return 0
        end
    end
    local gone, seen = {}, {}
    local removed, sum = 0, 0
    local current = redis.call('HMGET', state, pending .. 'min', pending .. 'max')
    local min, max = tonumber(current[1]), tonumber(current[2])
    local extremum = false
    for offset = 1, #ids, BATCH do
        local last = math.min(offset + BATCH - 1, #ids)
        local entries = redis.call('HMGET', pending_key, unpack(ids, offset, last))
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
        return 0
    end
    for offset = 1, #gone, BATCH do
        redis.call('HDEL', pending_key, unpack(gone, offset, math.min(offset + BATCH - 1, #gone)))
    end
    local count = tonumber(redis.call('HINCRBY', state, pending .. 'count', -removed))
    redis.call('HINCRBYFLOAT', state, pending .. 'sum', -sum)
    if count <= 0 then
        redis.call('HDEL', state, pending .. 'count', pending .. 'sum', pending .. 'min', pending .. 'max')
        local cutoff = redis.call('HGET', state, 'cold_until')
        -- Polar counts the whole bucket once it is cold: the local copy has nothing left to add.
        if cutoff and tonumber(start) < tonumber(cutoff) then
            redis.call('HDEL', state, bucket .. 'count', bucket .. 'sum', bucket .. 'min', bucket .. 'max')
        end
    elseif extremum then
        -- Extrema cannot be decremented: read them off the events still pending.
        min, max = nil, nil
        for _, entry in ipairs(redis.call('HVALS', pending_key)) do
            local value = value_of(entry)
            if value then
                if not min or value < min then min = value end
                if not max or value > max then max = value end
            end
        end
        for func, value in pairs({min = min, max = max}) do
            redis.call('HSET', state, pending .. func, tostring(value))
        end
        if not min then redis.call('HDEL', state, pending .. 'min') end
        if not max then redis.call('HDEL', state, pending .. 'max') end
    end
    redis.call('EXPIRE', state, 86400)
    return removed
end
local entries = tonumber(ARGV[4])
if entries > 0 then
    local ids = {}
    for i = 5, 4 + entries do table.insert(ids, ARGV[i]) end
    for offset = 1, #ids, BATCH do
        local batch = {unpack(ids, offset, math.min(offset + BATCH - 1, #ids))}
        redis.call('XACK', KEYS[1], 'polar', unpack(batch))
        redis.call('XDEL', KEYS[1], unpack(batch))
    end
    -- The flusher holds its slot through the next batch.
    if redis.call('GET', KEYS[2]) == ARGV[2] then
        redis.call('PEXPIRE', KEYS[2], ARGV[3])
    end
end
local removed, cursor = 0, 5 + entries
for group = 1, (#KEYS - 2) / 2 do
    local start, count = ARGV[cursor], tonumber(ARGV[cursor + 1])
    local ids = {}
    for i = cursor + 2, cursor + 1 + count do table.insert(ids, ARGV[i]) end
    removed = removed + settle(KEYS[2 * group + 1], KEYS[2 * group + 2], start, ids)
    cursor = cursor + 2 + count
end
return removed
