import { useState } from "react";
import { ActionIcon, Box, Button, Group, CopyButton, Text, TextInput, Tooltip } from "@mantine/core";
import { useFriendship } from "@/contexts/FriendshipContext";
import { useSocket } from "@/contexts/SocketContext";
import { IconCopy, IconCheck, IconRefresh } from '@tabler/icons-react';

export function AddFriendBox() {
  const { friendCode, setFriendCode, setFriendRequests } = useFriendship();
  const { socket } = useSocket();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resetted, setReset] = useState(false);

  function handleSend() {
    if (!socket || !code.trim()) return;
    setError(null);
    setSent(false);

    socket.emit("friendRequest", { friendCode: code.trim() });

    socket.once("friendRequestSent", (request) => {
      setFriendRequests((prev) => [...prev, request]);
      setSent(true);
      setCode("");
      setTimeout(() => setSent(false), 3000);
    });

    socket.once("error", ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });
  }

  const resettedTooltip = "Reset friend code";

  async function handleResetFriend() {
    try {
      setReset(true);
      const res = await fetch("/api/friends", {
        method: "PUT",
      });
      const data = await res.json();
      if (res.ok) {
        setFriendCode(data.newFriendCode);
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

  return (
    <Box>
      <Group gap={6} align="center" mb={2}>
        <Text
          size="xs"
          c="dimmed"
          style={{
            display: "flex",
            alignItems: "center",
            height: 30,
          }}
        >
          Add friend by code
        </Text>

        <CopyButton value={friendCode as string} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip
              label={copied ? 'Copied' : 'Copy friend code'}
              withArrow
            >
              <ActionIcon
                size={20}
                onClick={copy}
                variant="subtle"
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>

        <ActionIcon
          onClick={handleResetFriend}
          disabled={resetted}
          variant="subtle"
          size={16}
          color="red"
        >
          <Tooltip
            label={resetted ? "Reset!" : resettedTooltip}
            withArrow
          >
            {resetted ? <IconCheck size={16} /> : <IconRefresh size={16} />}
          </Tooltip>
        </ActionIcon>
      </Group>
      <Box style={{ display: "flex", gap: 6 }}>
        <TextInput
          placeholder={friendCode ?? "Code..."}
          // size="xs"
          value={code}
          onChange={(e) => {
            setCode(e.currentTarget.value);
            setSent(false);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          styles={{
            input: {
              fontFamily: "monospace"
            },
          }}
          style={{ flex: 1 }}
        />
        <Button size="input-xs" onClick={handleSend}>
          Add
        </Button>
      </Box>
      {error && <Text size="xs" c="red" mt={4}>{error}</Text>}
      {sent && <Text size="xs" c="green" mt={4}>Friend request sent!</Text>}
    </Box>
  );
}