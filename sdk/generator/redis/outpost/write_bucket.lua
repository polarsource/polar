local bucket = 'bucket:' .. ARGV[1] .. ':'
local pending = 'pending:' .. ARGV[1] .. ':'
-- ARGV[2] is the event's value, or nothing when it only counts.
local value = ARGV[2] ~= '' and tonumber(ARGV[2]) or nil
assert(ARGV[2] == '' or (value and value == value and math.abs(value) ~= math.huge), 'Invalid value')
if redis.call('HEXISTS', KEYS[3], ARGV[3]) == 1 then
    return 0
end
local total = tonumber(redis.call('HGET', KEYS[1], bucket .. 'sum') or '0') + (value or 0)
assert(total == total and math.abs(total) ~= math.huge, 'Aggregation values must be finite')
-- One event pending, under its external_id, ARGV[3]. An external_id Polar has not confirmed yet:
-- tracking it again changes nothing.
if redis.call('HSETNX', KEYS[2], ARGV[3], ARGV[2]) == 0 then
    return 0
end
-- The write that first sees an event queues it for Polar, as Polar ingests it: KEYS[4] is the
-- stream, ARGV[4] the event, or nothing for the other reducers the event matches. A flusher
-- holding the first slot, KEYS[5], reads the stream again once it lets go: it delivers the event.
-- Otherwise the write returns 2, and the instance drains the stream on its next flush.
local written = 1
if ARGV[4] ~= '' then
    redis.call('XADD', KEYS[4], '*', 'event', ARGV[4])
    if redis.call('EXISTS', KEYS[5]) == 0 then
        written = 2
    end
end
-- Every local event counts in its bucket; the pending part is what Polar has not confirmed.
for _, prefix in ipairs({bucket, pending}) do
    redis.call('HINCRBYFLOAT', KEYS[1], prefix .. 'sum', value and ARGV[2] or '0')
    redis.call('HINCRBY', KEYS[1], prefix .. 'count', 1)
    if value then
        for _, func in ipairs({'min', 'max'}) do
            local stored = redis.call('HGET', KEYS[1], prefix .. func)
            local previous = stored and tonumber(stored)
            if not previous or (func == 'min' and value < previous)
                or (func == 'max' and value > previous) then
                redis.call('HSET', KEYS[1], prefix .. func, ARGV[2])
            end
        end
    end
end
-- Events nobody confirms are forgotten an hour after the last write to their bucket. A state
-- nobody reads, writes or snapshots for a day is forgotten too: the next read rebuilds it from
-- Polar's snapshot.
redis.call('EXPIRE', KEYS[2], 3900)
redis.call('EXPIRE', KEYS[1], 86400)
return written
