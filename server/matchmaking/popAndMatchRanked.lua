local key = KEYS[1]
local now = tonumber(ARGV[1])

local entries = redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
if #entries < 4 then return {} end

local members = {}
for i = 1, #entries, 2 do
  local data = entries[i]
  local elo = tonumber(entries[i+1])
  local joinedAt = tonumber(string.match(data, '"joinedAt":(%d+)')) or now
  local isParty = string.find(data, '"partyId"') ~= nil
  local playerCount = isParty and 2 or 1
  local waitSeconds = (now - joinedAt) / 1000

  local tolerance
  if waitSeconds < 30 then tolerance = 400
  elseif waitSeconds < 60 then tolerance = 800
  elseif waitSeconds < 120 then tolerance = 1200
  elseif waitSeconds < 240 then tolerance = 2000
  else tolerance = 5000
  end

  table.insert(members, { data = data, elo = elo, tolerance = tolerance, playerCount = playerCount })
end

for i = 1, #members do
  local window = {}
  local total = 0

  for j = i, #members do
    table.insert(window, members[j])
    total = total + members[j].playerCount
    if total >= 4 then break end
  end

  if total == 4 then
    local gap = math.abs(window[#window].elo - window[1].elo)
    local allowed = 0
    for _, m in ipairs(window) do
      if m.tolerance > allowed then allowed = m.tolerance end
    end

    if gap <= allowed then
      for _, m in ipairs(window) do
        redis.call('ZREM', key, m.data)
      end

      local out = {}
      if #window == 2 then
        table.insert(out, window[1].data)
        table.insert(out, window[2].data)
      elseif #window == 3 then
        if window[1].playerCount == 2 then
          table.insert(out, window[1].data)
          table.insert(out, window[2].data)
          table.insert(out, window[3].data)
        else
          table.insert(out, window[1].data)
          table.insert(out, window[3].data)
          table.insert(out, window[2].data)
        end
      else
        table.insert(out, window[1].data)
        table.insert(out, window[3].data)
        table.insert(out, window[2].data)
        table.insert(out, window[4].data)
      end

      return out
    end
  end
end

return {}