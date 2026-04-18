local key = KEYS[1]
local now = tonumber(ARGV[1])

local entries = redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
if #entries < 4 then return {} end

local members = {}
for i = 1, #entries, 2 do
  local data = entries[i]
  local elo = tonumber(entries[i+1])
  local joinedAt = tonumber(string.match(data, '"joinedAt":(%d+)'))
  local waitSeconds = (now - joinedAt) / 1000

  local tolerance
  if waitSeconds < 30 then tolerance = 100
  elseif waitSeconds < 60 then tolerance = 200
  elseif waitSeconds < 120 then tolerance = 400
  else tolerance = 600
  end

  table.insert(members, { data = data, elo = elo, tolerance = tolerance })
end

if #members < 2 then return {} end

for i = 1, #members do
  for j = i + 1, #members do
    local gap = math.abs(members[i].elo - members[j].elo)
    -- use the more lenient of the two tolerances
    local allowed = math.min(members[i].tolerance, members[j].tolerance)
    if gap <= allowed then
      redis.call('ZREM', key, members[i].data)
      redis.call('ZREM', key, members[j].data)
      return { members[i].data, members[j].data }
    end
  end
end

return {}