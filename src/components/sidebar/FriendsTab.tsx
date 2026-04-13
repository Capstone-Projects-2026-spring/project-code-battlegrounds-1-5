import { useState } from "react";
import { Avatar, Box, Button, Stack, Text } from "@mantine/core";
import { useFriendship } from "@/contexts/FriendshipContext";
import { useParty } from "@/contexts/PartyContext";
import { useSocket } from "@/contexts/SocketContext";
import { AddFriendBox } from "./AddFriendBox";

export function FriendsTab() {
  const { friends } = useFriendship();
  const { partyMember, joinedParty } = useParty();
  const { socket } = useSocket();
  const [sent, setSent] = useState<Set<string>>(new Set());

  const isFull = partyMember !== null || joinedParty !== null;

  const sorted = [...friends].sort((a, b) => {
    const order = { online: 0, away: 1, offline: 2 };
    return order[a.status] - order[b.status];
  });

  function handleInvite(friendId: string) {
    if (!socket) return;
    socket.emit("partyInvite", { toUserId: friendId });
    setSent((s) => new Set(s).add(friendId));
    setSent((s) => new Set(s).add(friendId));

    setTimeout(() => {
      setSent((s) => {
        const next = new Set(s);
        next.delete(friendId);
        return next;
      });
    }, 3000);
  
  }

  return (
    <Stack gap={8}>
      <AddFriendBox />

      {sorted.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No friends yet
        </Text>
      ) : (
        <Stack gap={2}>
          {sorted.map((friend) => (
            <Box
              key={friend.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 8px",
                borderRadius: 8,
              }}
            >
              <Box style={{ position: "relative", flexShrink: 0 }}>
                <Avatar src={friend.avatarUrl} radius="xl" size={30}>
                  {friend.displayName.slice(0, 2).toUpperCase()}
                </Avatar>
                <Box
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    border: "1.5px solid white",
                    background:
                      friend.status === "online"
                        ? "#22c55e"
                        : friend.status === "away"
                        ? "#f59e0b"
                        : "var(--mantine-color-gray-4)",
                  }}
                />
              </Box>

              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={500} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {friend.displayName}
                </Text>
                <Text size="xs" c="dimmed">{friend.activity ?? friend.status}</Text>
              </Box>

              {sent.has(friend.id) ? (
                <Text size="xs" c="green">Sent</Text>
              ) : (
                <Button
                  size="xs"
                  variant="light"
                  disabled={friend.status === "offline" || isFull}
                  onClick={() => handleInvite(friend.id)}
                >
                  Invite
                </Button>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}