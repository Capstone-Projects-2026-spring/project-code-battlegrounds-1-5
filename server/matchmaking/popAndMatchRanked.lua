local key = KEYS[1]
local now = tonumber(ARGV[1])

local entries = redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
if #entries < 4 then return {} end  -- minimum 2 entries (data+score each) = 4 items

local members = {}
for i = 1, #entries, 2 do
  local data = entries[i]
  local elo = tonumber(entries[i+1])
  local joinedAt = tonumber(string.match(data, '"joinedAt":(%d+)'))
  local isParty = string.find(data, '"partyId"') ~= nil
  local playerCount = isParty and 2 or 1
  local waitSeconds = (now - joinedAt) / 1000

  local tolerance
  if waitSeconds < 30 then tolerance = 100
  elseif waitSeconds < 60 then tolerance = 200
  elseif waitSeconds < 120 then tolerance = 400
  else tolerance = 600
  end

  table.insert(members, { data = data, elo = elo, tolerance = tolerance, playerCount = playerCount })
end

-- sliding window: find consecutive entries that total exactly 4 players
for i = 1, #members do
  local window = {}
  local total = 0

  for j = i, #members do
    table.insert(window, members[j])
    total = total + members[j].playerCount
    if total >= 4 then break end
  end

  if total < 4 then break end  -- no more combinations possible (sorted, so won't improve)

  -- check elo gap across this window
  local minElo = window[1].elo
  local maxElo = window[#window].elo
  local gap = maxElo - minElo  -- already sorted ascending so this is always the max gap
  local allowed = 0
  for _, m in ipairs(window) do
    if m.tolerance > allowed then allowed = m.tolerance end
  end

  if gap <= allowed then
    for _, m in ipairs(window) do
      redis.call('ZREM', key, m.data)
    end

    -- build return: interleave for balanced teams
    -- if all solo: a,c vs b,d
    -- if party + 2 solos: party is one team, solos are the other
    -- if 2 parties: party1 vs party2
    local out = {}
    if #window == 2 then
      -- two parties
      for _, m in ipairs(window) do table.insert(out, m.data) end
    elseif #window == 3 then
      -- one party + two solos: figure out which is the party
      if window[1].playerCount == 2 then
        -- party first: party vs solo+solo
        table.insert(out, window[1].data)
        table.insert(out, window[2].data)
        table.insert(out, window[3].data)
      else
        -- party last: solo+solo vs party
        table.insert(out, window[1].data)
        table.insert(out, window[3].data)
        table.insert(out, window[2].data)
      end
    else
      -- 4 solos: interleave
      table.insert(out, window[1].data)
      table.insert(out, window[3].data)
      table.insert(out, window[2].data)
      table.insert(out, window[4].data)
    end

    return out
  end
end

return {}