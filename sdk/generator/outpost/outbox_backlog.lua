-- The outbox's length and how many of its entries flushers hold: KEYS[1] is the outbox, ARGV[1]
-- the consumer group.
local length = redis.call('XLEN', KEYS[1])
if length == 0 then
    return {0, 0}
end
return {length, redis.call('XPENDING', KEYS[1], ARGV[1])[1]}
