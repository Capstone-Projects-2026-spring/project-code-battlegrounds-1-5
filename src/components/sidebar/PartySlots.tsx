import { useState } from "react";
import { Avatar, Box, Button, CopyButton, Group, Text, Tooltip, ActionIcon, Stack, Input, TextInput } from "@mantine/core";
import { useParty } from "@/contexts/PartyContext";
import { useSocket } from "@/contexts/SocketContext";
import { authClient } from "@/lib/auth-client";
import { IconRefresh, IconCheck, IconCopy, IconX } from "@tabler/icons-react";

export function PartySlots() {
  const { partyMember, setPartyMember, partyCode, setPartyCode, joinedParty, setJoinedParty } = useParty();
  const { socket } = useSocket();
  const { data: session } = authClient.useSession();

  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [resetted, setReset] = useState<boolean>(false);

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

  const resettedTooltip = "Reset party code";

  async function handleResetCode() {
    try {
      setReset(true);
      const res = await fetch("/api/party", {
        method: "PUT",
      });
      const data = await res.json();
      if (res.ok) {
        setPartyCode(data.newId);
        setReset(true);
        setTimeout(() => setReset(false), 3000);
      } else {
        console.log(data);
        setTimeout(() => setReset(false), 3000);
      }

    } catch (e) {
      console.error(e);
      setTimeout(() => setReset(false), 3000);
    }

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
      <Text size="xs" c="dimmed" mb={2}>Click to copy your party code</Text>
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
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={handleLeave}
                >
                  <IconX />
                </ActionIcon>
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
                <CopyButton value={partyCode as string} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip
                      label={copied ? 'Copied' : inviteTooltip}
                      position="bottom"
                      withArrow
                      color={copied ? "green" : undefined}
                    >
                      <ActionIcon
                        size={50}
                        onClick={copy}
                        variant="transparent"
                      >
                        <Avatar radius="xl" size={50} style={{
                          border: "2px dashed var(--mantine-color-gray-4)",
                          background: "transparent",
                          cursor: "default",
                          color: "var(--mantine-color-blue-5)",
                          fontSize: 22,
                        }}>
                          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        </Avatar>
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              )}
              <Text size="xs" c={partyMember ? "dimmed" : "blue"}>
                {partyMember ? partyMember.displayName.split(" ")[0] : "Invite"}
              </Text>
            </Box>

            {/* Kick button */}
            {partyMember && (
              <Box style={{ flex: 1, display: "flex", justifyContent: "flex-end", paddingTop: 14 }}>
                <Tooltip label="Kick from party" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={handleKick}
                  >
                    <IconX />
                  </ActionIcon>
                </Tooltip>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Join by code — hidden whenever already in any party */}
      {!isInAnyParty && (
        <Box style={{ borderRadius: 8, padding: "10px 12px" }}>
          <Group gap={6} align="center" mb={2}>
            <Text size="xs" c="dimmed">Have a code? Join a party</Text>

            <ActionIcon onClick={handleResetCode} disabled={resetted} variant="subtle" size={16}>
              <Tooltip label={resetted ? "Resetting" : resettedTooltip} withArrow position="right">
                {resetted ? <IconCheck size={16} /> : <IconRefresh size={16} />}
              </Tooltip>
            </ActionIcon>
          </Group>
          <Box style={{ display: "flex", gap: 6 }}>
            <TextInput
              placeholder={partyCode ?? "Code..."}
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
              styles={{
                input: {
                  fontFamily: "monospace"
                }
              }}
              style={{
                flex: 1
              }}
            />
            <Button
              size="input-xs"
              onClick={handleJoinByCode}
              disabled={!joinInput}
            >
              Join
            </Button>
          </Box>
          {joinError && <Text size="xs" c="red" mt={4}>{joinError}</Text>}
        </Box>
      )}
    </Stack>
  );
}