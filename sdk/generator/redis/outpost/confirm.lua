-- KEYS holds a state and pending hash per group, plus a rejection hash in reject mode.
-- ARGV starts with the mode, then each group's bucket start, ID count and IDs.
local BATCH = 1000
local mode = ARGV[1]
-- An entry is the event's value, or nothing when it only counts.
local function value_of(entry)
    return entry ~= '' and tonumber(entry) or nil
end
local function settle(state, pending_key, start, ids, rejection_key)
    local bucket = 'bucket:' .. start .. ':'
    local pending = 'pending:' .. start .. ':'
    local confirmed = 'confirmed:' .. start .. ':'
    local invalid = 'invalid:' .. start .. ':'
    local cutoff = tonumber(redis.call('HGET', state, 'cold_until'))
    local hot = not cutoff or tonumber(start) >= cutoff
    -- Polar received the events but no snapshot counts them yet: a cold bucket keeps them
    -- pending for the snapshot that will, a hot one counts them whole either way.
    if mode == 'ack' and not hot then
        return 0
    end
    if rejection_key then
        for offset = 1, #ids, BATCH do
            local fields = {}
            for i = offset, math.min(offset + BATCH - 1, #ids) do
                fields[#fields + 1] = ids[i]
                fields[#fields + 1] = '1'
            end
            redis.call('HSET', rejection_key, unpack(fields))
        end
        redis.call('EXPIRE', rejection_key, 3900)
    end
    local gone, seen = {}, {}
    local removed, sum = 0, 0
    local current = redis.call('HMGET', state, pending .. 'min', pending .. 'max')
    local min, max = tonumber(current[1]), tonumber(current[2])
    local extremum = false
    local removed_min, removed_max
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
                    removed_min = not removed_min and value or math.min(removed_min, value)
                    removed_max = not removed_max and value or math.max(removed_max, value)
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
    if mode == 'ack' then
        redis.call('HINCRBY', state, confirmed .. 'count', removed)
        if removed_min then
            local accepted = redis.call('HMGET', state, confirmed .. 'min', confirmed .. 'max')
            local low, high = tonumber(accepted[1]), tonumber(accepted[2])
            redis.call('HSET', state,
                confirmed .. 'min', low and math.min(low, removed_min) or removed_min,
                confirmed .. 'max', high and math.max(high, removed_max) or removed_max)
        end
    elseif rejection_key and hot then
        local remaining = tonumber(redis.call('HINCRBY', state, bucket .. 'count', -removed))
        if remaining <= 0 then
            redis.call('HDEL', state, bucket .. 'count', bucket .. 'sum', bucket .. 'min', bucket .. 'max')
        else
            redis.call('HINCRBYFLOAT', state, bucket .. 'sum', -sum)
            local legacy = remaining - count > tonumber(redis.call('HGET', state, confirmed .. 'count') or '0')
            for _, func in ipairs({'min', 'max'}) do
                local removed_edge = func == 'min' and removed_min or removed_max
                if removed_edge and removed_edge == tonumber(redis.call('HGET', state, bucket .. func)) then
                    if legacy then
                        -- Older SDKs did not keep confirmed extrema. Let the read fall back until the bucket seals.
                        redis.call('HSET', state, invalid .. func, '1')
                    else
                        local edges = redis.call('HMGET', state, confirmed .. func, pending .. func)
                        local a, b = tonumber(edges[1]), tonumber(edges[2])
                        local edge
                        if a and b then
                            edge = func == 'min' and math.min(a, b) or math.max(a, b)
                        else
                            edge = a or b
                        end
                        if edge then
                            redis.call('HSET', state, bucket .. func, edge)
                        else
                            redis.call('HDEL', state, bucket .. func)
                        end
                    end
                end
            end
        end
    end
    redis.call('EXPIRE', state, 86400)
    return removed
end
local removed, cursor = 0, 2
local stride = mode == 'reject' and 3 or 2
for key = 1, #KEYS, stride do
    local start, count = ARGV[cursor], tonumber(ARGV[cursor + 1])
    local ids = {}
    for i = cursor + 2, cursor + 1 + count do table.insert(ids, ARGV[i]) end
    local rejected = stride == 3 and KEYS[key + 2] or nil
    removed = removed + settle(KEYS[key], KEYS[key + 1], start, ids, rejected)
    cursor = cursor + 2 + count
end
return removed
