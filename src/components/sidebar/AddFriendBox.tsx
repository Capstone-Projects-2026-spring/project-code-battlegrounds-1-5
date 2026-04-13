import { useState } from "react";
import { Box, Button, Text, TextInput } from "@mantine/core";
import { useFriendship } from "@/contexts/FriendshipContext";
import { useSocket } from "@/contexts/SocketContext";

export function AddFriendBox() {
  const { friendCode, setFriendRequests } = useFriendship();
  const { socket } = useSocket();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSend() {
    if (!socket || !code.trim()) return;
    setError(null);
    setSent(false);

    socket.emit("friendRequest", { friendCode: code.trim() });

    socket.once("friendRequestSent", (request) => {
      setFriendRequests((prev) => [...prev, request]);
      setSent(true);
      setCode("");
    });

    socket.once("error", ({ message }: { message: string }) => {
      setError(message);
    });
  }

  return (
    <Box>
      <Text size="xs" c="dimmed" mb={6}>
        Add friend by code
      </Text>
      <Box style={{ display: "flex", gap: 6 }}>
        <TextInput
          placeholder={`Your code: ${friendCode}`}
          size="xs"
          value={code}
          onChange={(e) => {
            setCode(e.currentTarget.value);
            setSent(false);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          styles={{
            input: {
              fontFamily: "monospace",
              letterSpacing: "0.08em",
            },
          }}
          style={{ flex: 1 }}
        />
        <Button size="xs" onClick={handleSend}>
          Add
        </Button>
      </Box>
      {error && <Text size="xs" c="red" mt={4}>{error}</Text>}
      {sent && <Text size="xs" c="green" mt={4}>Friend request sent!</Text>}
    </Box>
  );
}