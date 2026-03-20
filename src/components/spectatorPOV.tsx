import { useState } from "react";
import { Box, Group, Button, Center, Text } from "@mantine/core";
import CoderPOV from "@/components/coderPOV";
import TesterPOV from "@/components/testerPOV";
import type { ActiveProblem } from "@/components/ProblemBox";
import { Socket } from "socket.io-client";

interface SpectatorPOVProps {
  socket: Socket;
  roomId: string;
  timeRemaining: number;
  duration: number;
  gameState: "Waiting" | "In Progress" | "Completed";
  problem: ActiveProblem | null;
}

export default function SpectatorPOV({ socket, roomId, timeRemaining, duration, gameState, problem }: SpectatorPOVProps) {
  const [view, setView] = useState<'none' | 'coder' | 'tester'>('none');

  return (
    //The exit view button is temporary for testing purposes.
    <Box style={{ position: 'relative', height: '100vh' }}>
      <Box style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
        <Group gap="xs">
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
          <CoderPOV socket={socket} roomId={roomId} isSpectator={true} timeRemaining={timeRemaining} duration={duration} gameState={gameState} problem={problem} />
        </Box>
      )}

      {view === 'tester' && (
        <Box style={{ height: '100%' }}>
          <TesterPOV socket={socket} roomId={roomId} isSpectator={true} timeRemaining={timeRemaining} duration={duration} gameState={gameState} problem={problem} />
        </Box>
      )}
    </Box>
  );
}