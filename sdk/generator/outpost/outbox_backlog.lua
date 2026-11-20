-- The outbox's length, how many of its entries flushers hold, and when the fleet may send it
-- again after Polar failed: KEYS[1] is the outbox, KEYS[2] its backoff, ARGV[1] the consumer group.
-- ARGV[2], optional, is the retry the caller read before it delivered: Polar takes batches
-- again, so that backoff ends, unless a flusher failed since and set a later one.
if ARGV[2] and redis.call('HGET', KEYS[2], 'retry_at') == ARGV[2] then
    redis.call('DEL', KEYS[2])
end
local retry_at = redis.call('HGET', KEYS[2], 'retry_at') or ''
local length = redis.call('XLEN', KEYS[1])
if length == 0 then
    return {0, 0, retry_at}
end
return {length, redis.call('XPENDING', KEYS[1], ARGV[1])[1], retry_at}
