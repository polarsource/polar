redis.call('XACK', KEYS[1], ARGV[1], unpack(ARGV, 4))
redis.call('XDEL', KEYS[1], unpack(ARGV, 4))
if redis.call('GET', KEYS[2]) == ARGV[2] then
    redis.call('PEXPIRE', KEYS[2], ARGV[3])
end
