-- An instance's exports in one command. KEYS are the spans and the metrics lists; ARGV[1] is how
-- many exports each list keeps, the newest; ARGV[2] how many of the values after it are spans,
-- the rest being metrics.
local spans = tonumber(ARGV[2])
local ranges = {{3, 2 + spans}, {3 + spans, #ARGV}}
for i, key in ipairs(KEYS) do
    local first, last = ranges[i][1], ranges[i][2]
    if last >= first then
        redis.call('RPUSH', key, unpack(ARGV, first, last))
        redis.call('LTRIM', key, -tonumber(ARGV[1]), -1)
    end
end
return 1
