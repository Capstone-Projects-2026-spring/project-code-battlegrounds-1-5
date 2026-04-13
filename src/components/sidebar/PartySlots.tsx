import { useState } from "react";
import { Avatar, Box, Button, Text, Tooltip, ActionIcon, Stack } from "@mantine/core";
import { useParty } from "@/contexts/PartyContext";
import { useSocket } from "@/contexts/SocketContext";
import { authClient } from "@/lib/auth-client";

export function PartySlots() {
  const { partyMember, setPartyMember, partyCode, joinedParty, setJoinedParty } = useParty();
  const { socket } = useSocket();
  const { data: session } = authClient.useSession();

  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  function handleKick() {
    if (!socket) return;
    socket.emit("partyKick");
    setPartyMember(null);
  }

  function handleLeave() {
    if (!socket) return;
    socket.emit("partyLeave");
    setJoinedParty(null);
  }

  function handleJoinByCode() {
    if (!socket || !joinInput.trim()) return;
    setJoinError(null);
    socket.emit("partyJoinByCode", { code: joinInput.trim() });
    socket.once("partyJoined", (member) => {
      setJoinedParty(member);
      setJoinInput("");
    });
    socket.once("error", ({ message }: { message: string }) => {
      setJoinError(message);
      setTimeout(() => setJoinError(null), 3000);
    });
  }

  const inviteTooltip = partyCode ? (
    <Box>
      <Text size="xs" c="dimmed" mb={2}>Share your party code</Text>
      <Text style={{ fontFamily: "monospace", fontWeight: 600, letterSpacing: "0.1em" }}>
        {partyCode}
      </Text>
    </Box>
  ) : "Invite someone";

  const isInAnyParty = joinedParty !== null || partyMember !== null;

  return (
    <Stack gap="xs">
      <Box style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {joinedParty ? (
          <>
            {/* Party owner */}
            <Box style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Tooltip label={joinedParty.displayName} withArrow>
                <Avatar src={joinedParty.avatarUrl} radius="xl" size={50} color="blue"
                  style={{ border: "2px solid var(--mantine-color-blue-5)" }}
                >
                  {joinedParty.displayName.slice(0, 2).toUpperCase()}
                </Avatar>
              </Tooltip>
              <Text size="xs" c="dimmed">{joinedParty.displayName.split(" ")[0]}</Text>
            </Box>

            {/* You (guest) */}
            <Box style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Avatar src={session?.user.image} radius="xl" size={50} color="gray"
                style={{ border: "2px solid var(--mantine-color-gray-4)" }}
              >
                {session?.user.name?.slice(0, 2).toUpperCase()}
              </Avatar>
              <Text size="xs" c="dimmed">You</Text>
            </Box>

            {/* Leave button */}
            <Box style={{ flex: 1, display: "flex", justifyContent: "flex-end", paddingTop: 14 }}>
              <Tooltip label="Leave party" withArrow>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={handleLeave}>✕</ActionIcon>
              </Tooltip>
            </Box>
          </>
        ) : (
          <>
            {/* You (owner) */}
            <Box style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Avatar src={session?.user.image} radius="xl" size={50} color="blue"
                style={{ border: "2px solid var(--mantine-color-blue-5)" }}
              >
                {session?.user.name?.slice(0, 2).toUpperCase()}
              </Avatar>
              <Text size="xs" c="dimmed">You</Text>
            </Box>

            {/* Guest slot */}
            <Box style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {partyMember ? (
                <Tooltip label={partyMember.displayName} withArrow>
                  <Avatar src={partyMember.avatarUrl} radius="xl" size={50} color="gray">
                    {partyMember.displayName.slice(0, 2).toUpperCase()}
                  </Avatar>
                </Tooltip>
              ) : (
                <Tooltip label={inviteTooltip} withArrow>
                  <Avatar radius="xl" size={50} style={{
                    border: "2px dashed var(--mantine-color-gray-4)",
                    background: "transparent",
                    cursor: "default",
                    color: "var(--mantine-color-blue-5)",
                    fontSize: 22,
                  }}>
                    +
                  </Avatar>
                </Tooltip>
              )}
              <Text size="xs" c={partyMember ? "dimmed" : "blue"}>
                {partyMember ? partyMember.displayName.split(" ")[0] : "Invite"}
              </Text>
            </Box>

            {/* Kick button */}
            {partyMember && (
              <Box style={{ flex: 1, display: "flex", justifyContent: "flex-end", paddingTop: 14 }}>
                <Tooltip label="Kick from party" withArrow>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={handleKick}>✕</ActionIcon>
                </Tooltip>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Join by code — hidden whenever already in any party */}
      {!isInAnyParty && (
        <Box style={{ borderRadius: 8, padding: "10px 12px" }}>
          <Text size="xs" c="dimmed" mb={6}>Have a code? Join a party</Text>
          <Box style={{ display: "flex", gap: 6 }}>
            <input
              placeholder={`Your code: ${partyCode}`}
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
              style={{
                flex: 1,
                fontFamily: "monospace",
                fontSize: 13,
                padding: "4px 8px",
                border: "0.5px solid var(--mantine-color-gray-4)",
                borderRadius: 6,
                background: "transparent",
                color: "inherit",
                letterSpacing: "0.08em",
              }}
            />
            <Button size="xs" onClick={handleJoinByCode}>Join</Button>
          </Box>
          {joinError && <Text size="xs" c="red" mt={4}>{joinError}</Text>}
        </Box>
      )}
    </Stack>
  );
}