redis.call('EXPIRE', KEYS[1], 86400)
return redis.call('HGETALL', KEYS[1])
