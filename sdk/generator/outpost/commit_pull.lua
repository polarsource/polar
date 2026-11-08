-- Saves the cursor once a page of changes is applied. Returns 0 and saves nothing when this
-- instance no longer holds the pull lock: once the lock expired, another instance may pull.
local pull = KEYS[1]
local lock = KEYS[2]
local token = ARGV[1]
local cursor = ARGV[2]
local pulled_at = ARGV[3]
local next_poll_in = ARGV[4]
local channel = ARGV[5]
-- '1' on the last page: the pull is over and the lock goes.
local last_page = ARGV[6] == '1'

if redis.call('GET', lock) ~= token then
    return 0
end
redis.call('HSET', pull, 'cursor', cursor, 'pulled_at', pulled_at, 'next_poll_in', next_poll_in)
-- A pull that succeeds ends the backoff.
redis.call('HDEL', pull, 'failures', 'retry_at')
if last_page then
    redis.call('DEL', lock)
end
-- Every instance learns when the next pull is due.
redis.call('PUBLISH', channel,
    cjson.encode({pulled = {at = tonumber(pulled_at), next = tonumber(next_poll_in)}}))
return 1
