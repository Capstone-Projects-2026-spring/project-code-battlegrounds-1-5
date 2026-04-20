import { Avatar, Box, Button, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useFriendship } from "@/contexts/FriendshipContext";
import { useParty } from "@/contexts/PartyContext";
import { useSocket } from "@/contexts/SocketContext";

export function InvitesTab() {
  const { incomingRequests, setFriendRequests } = useFriendship();
  const { pendingInvite, setJoinedParty, setPendingInvite } = useParty();
  const { socket } = useSocket();

  const hasAnything = incomingRequests.length > 0 || pendingInvite !== null;

  function handleAcceptPartyInvite() {
    if (!socket || !pendingInvite) return;
    socket.emit("partyInviteAccept");
    socket.once("partyJoined", (member) => {
      setJoinedParty(member);
      setPendingInvite(null);
    });
    notifications.hide(`party-invite-${pendingInvite.fromUserId}`);
  }

  function handleDeclinePartyInvite() {
    if (!socket || !pendingInvite) return;
    socket.emit("partyInviteDecline");
    setPendingInvite(null);
    notifications.hide(`party-invite-${pendingInvite.fromUserId}`);
  }

  function handleAcceptFriendRequest(requestId: string) {
    if (!socket) return;
    socket.emit("friendRequestAccept", { requestId });
    setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    notifications.hide(`friend-request-${requestId}`);
  }

  function handleDeclineFriendRequest(requestId: string) {
    if (!socket) return;
    socket.emit("friendRequestDecline", { requestId });
    setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    notifications.hide(`friend-request-${requestId}`);
  }

  if (!hasAnything) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No pending invites
      </Text>
    );
  }

  return (
    <Stack gap={8}>

      {/* Party invite */}
      {pendingInvite && (
        <Box
          style={{
            border: "0.5px solid var(--mantine-color-gray-3)",
            borderLeft: "2px solid var(--mantine-color-blue-5)",
            borderRadius: "0 8px 8px 0",
            padding: "10px 12px",
          }}
        >
          <Text size="xs" c="blue" fw={500} mb={4}>Party invite</Text>
          <Box style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Avatar src={pendingInvite.fromAvatarUrl} radius="xl" size={28}>
              {pendingInvite.fromDisplayName.slice(0, 2).toUpperCase()}
            </Avatar>
            <Box style={{ flex: 1 }}>
              <Text size="xs" fw={500}>{pendingInvite.fromDisplayName}</Text>
              <Text size="xs" c="dimmed">wants you to join their party</Text>
            </Box>
          </Box>
          <Box style={{ display: "flex", gap: 6 }}>
            <Button size="xs" style={{ flex: 1 }} onClick={handleAcceptPartyInvite}>
              Join
            </Button>
            <Button size="xs" variant="default" style={{ flex: 1 }} onClick={handleDeclinePartyInvite}>
              Decline
            </Button>
          </Box>
        </Box>
      )}

      {/* Friend requests */}
      {incomingRequests.map((req) => (
        <Box
          key={req.id}
          style={{
            border: "0.5px solid var(--mantine-color-gray-3)",
            borderLeft: "2px solid #22c55e",
            borderRadius: "0 8px 8px 0",
            padding: "10px 12px",
          }}
        >
          <Text size="xs" c="green" fw={500} mb={4}>Friend request</Text>
          <Box style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Avatar src={req.avatarUrl} radius="xl" size={28}>
              {req.displayName.slice(0, 2).toUpperCase()}
            </Avatar>
            <Box style={{ flex: 1 }}>
              <Text size="xs" fw={500}>{req.displayName}</Text>
              <Text size="xs" c="dimmed">@{req.username}</Text>
            </Box>
          </Box>
          <Box style={{ display: "flex", gap: 6 }}>
            <Button size="xs" color="green" style={{ flex: 1 }} onClick={() => handleAcceptFriendRequest(req.id)}>
              Accept
            </Button>
            <Button size="xs" variant="default" style={{ flex: 1 }} onClick={() => handleDeclineFriendRequest(req.id)}>
              Decline
            </Button>
          </Box>
        </Box>
      ))}

    </Stack>
  );
}