-- What a snapshot needs before it applies, in one command. KEYS are the state and the missing
-- marker; ARGV[1] is '1' for a pulled snapshot, ARGV[2] its cold_until. A pulled snapshot of a
-- state Redis does not hold goes no further: false. Otherwise the customer is known again, and
-- the reply is the start of each bucket the snapshot seals that still holds pending events.
if ARGV[1] == '1' and redis.call('EXISTS', KEYS[1]) == 0 then
    return false
end
redis.call('DEL', KEYS[2])
local cold_until = tonumber(ARGV[2])
local sealed = {}
local fields = redis.call('HGETALL', KEYS[1])
for i = 1, #fields, 2 do
    local start = string.match(fields[i], '^pending:(%-?%d+):count$')
    if start and tonumber(start) < cold_until and tonumber(fields[i + 1]) > 0 then
        sealed[#sealed + 1] = start
    end
end
return sealed
