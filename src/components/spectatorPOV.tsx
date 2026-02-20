import React, { useState } from "react";
import { Box, Group, Button, Center, Text } from "@mantine/core";
import CoderPOV from "@/components/coderPOV";
import TesterPOV from "@/components/testerPOV";
import { Socket } from "socket.io-client";

interface SpectatorPOVProps {
  socket: Socket;
  roomId: string;
}

export default function SpectatorPOV({ socket, roomId }: SpectatorPOVProps) {
  const [view, setView] = useState<'none' | 'coder' | 'tester'>('none');

  return (
    <Box style={{ position: 'relative', height: '100vh' }}>
      <Box style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
        <Group spacing="xs">
          <Button size="sm" onClick={() => setView('coder')}>View Coder</Button>
          <Button size="sm" onClick={() => setView('tester')}>View Tester</Button>
          <Button size="sm" onClick={() => setView('none')}>Exit View</Button>

        </Group>
      </Box>

      {view === 'none' && (
        <Center h="100vh">
          <Text size="xl" c="dimmed">The room is full. You are spectating.</Text>
        </Center>
      )}

      {view === 'coder' && (
        <Box style={{ height: '100%' }}>
          <CoderPOV socket={socket} roomId={roomId} isSpectator={true} />
        </Box>
      )}

      {view === 'tester' && (
        <Box style={{ height: '100%' }}>
          <TesterPOV socket={socket} roomId={roomId} isSpectator={true} />
        </Box>
      )}
    </Box>
  );
}
