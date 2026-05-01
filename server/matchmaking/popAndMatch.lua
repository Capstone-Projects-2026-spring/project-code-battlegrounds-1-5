local key = KEYS[1]
local required = tonumber(ARGV[1])

if not required then
  return {}
end

local entries = redis.call('LRANGE', key, 0, required - 1)
local totalPlayers = 0
local entryCount = 0

for _, entry in ipairs(entries) do
  if string.find(entry, '"partyId"') then
    totalPlayers = totalPlayers + 2
  else
    totalPlayers = totalPlayers + 1
  end
  entryCount = entryCount + 1
  if totalPlayers >= required then
    break
  end
end

if totalPlayers < required then
  return {}
end

local popped = {}
local collected = 0
for i = 1, entryCount do
  local entry = redis.call('LPOP', key)
  if not entry then break end
  table.insert(popped, entry)
  if string.find(entry, '"partyId"') then
    collected = collected + 2
  else
    collected = collected + 1
  end
  if collected >= required then
    break
  end
end

return popped
