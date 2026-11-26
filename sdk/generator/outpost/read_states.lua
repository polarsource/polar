-- A customer's read in one command: for each reducer, KEYS holds its state and its missing marker,
-- and the last key is the pull, whose reset and fetch count go back after the reads. ARGV names, per reducer, the statistics the reader adds up,
-- comma-separated, or none for its readiness alone. A state keeps cold_until, reset and those
-- statistics of the groups the read counts: the cold totals, the pending part of cold buckets,
-- the hot buckets. Values go back as stored; the reader adds them up.
local reads = {}
for i = 1, #ARGV do
    local state = KEYS[2 * i - 1]
    redis.call('EXPIRE', state, 86400)
    local fields = redis.call('HGETALL', state)
    local wanted = {}
    for statistic in string.gmatch(ARGV[i], '[^,]+') do
        wanted[statistic] = true
    end
    local cold_until
    for j = 1, #fields, 2 do
        if fields[j] == 'cold_until' then
            cold_until = tonumber(fields[j + 1])
        end
    end
    local kept = {}
    for j = 1, #fields, 2 do
        local field = fields[j]
        local keep = field == 'cold_until' or field == 'reset'
        local group, statistic = string.match(field, '^(.+):(%a+)$')
        if not keep and group and wanted[statistic] then
            if group == 'cold' then
                keep = true
            else
                local kind, start = string.match(group, '^(%a+):(%-?%d+)$')
                start = tonumber(start)
                if kind == 'bucket' then
                    keep = cold_until == nil or start >= cold_until
                elseif kind == 'pending' then
                    keep = cold_until ~= nil and start < cold_until
                end
            end
        end
        if keep then
            kept[#kept + 1] = field
            kept[#kept + 1] = fields[j + 1]
        end
    end
    reads[i] = {redis.call('HGET', KEYS[2 * i], 'retry_at'), kept}
end
reads[#ARGV + 1] = redis.call('HGET', KEYS[#KEYS], 'reset')
reads[#ARGV + 2] = redis.call('HGET', KEYS[#KEYS], 'fetched')
return reads
