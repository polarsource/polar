if not redis.call('HGET', KEYS[1], 'epoch') then
    redis.call('HSET', KEYS[1], 'epoch', ARGV[1], 'revision', '0')
end
redis.call('EXPIRE', KEYS[1], 86400)
return redis.call('HGETALL', KEYS[1])
