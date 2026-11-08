-- Counts one more failure in a row on a key the whole fleet shares, such as the pull's, and
-- says when to try again. Each failure in a row doubles the wait, up to a maximum.
local key = KEYS[1]
local now = tonumber(ARGV[1])
local first_delay = tonumber(ARGV[2])
local max_delay = tonumber(ARGV[3])
local channel = ARGV[4]
-- Optional: the key expires this many milliseconds later, and its failures with it.
local forget_after = ARGV[5]

local failures = redis.call('HINCRBY', key, 'failures', 1)
local delay = math.min(max_delay, first_delay * 2 ^ math.min(failures - 1, 16))
local retry_at = now + delay
redis.call('HSET', key, 'retry_at', retry_at)
if forget_after then
    redis.call('PEXPIRE', key, forget_after)
end
-- Every instance learns when it may try again.
redis.call('PUBLISH', channel, cjson.encode({failed = {key = key, retry = retry_at}}))
return retry_at
