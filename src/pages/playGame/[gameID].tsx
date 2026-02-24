import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Center, Loader, Text, Group } from '@mantine/core';
import { io, Socket } from 'socket.io-client';

import CoderPOV from '@/components/coderPOV';
import TesterPOV from '@/components/testerPOV';

// TODO: this route should be auth checked (only allow signed-in users to join, not anyone with the URL)

export default function PlayGameRoom() {
  // 1. Grab the ID from the URL (e.g., "624")
  const router = useRouter();
  const gameId = router.query.gameID as string;

  // 2. Set up our state for the socket connection and the user's role
  const [role, setRole] = useState<'coder' | 'tester' | 'spectator' | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // ONLY HAPPENS ON PAGE LAUNCH
  useEffect(() => {
    if (!gameId) return;

    // 3. Initialize the connection to our custom server.js backend
    const socketInstance = io();
    setSocket(socketInstance);

    // 4. Ask the server to put us in the room for this specific game
    // sends a signal to the server that we want to join a specific game room, identified by gameId
    socketInstance.emit('joinGame', gameId);

    // 5. Wait for the server to reply with our role (coder, tester, or spectator)
    socketInstance.on('roleAssigned', (assignedRole) => {
      setRole(assignedRole);
    });

    // 6. Cleanup: disconnect the socket if the user leaves the page
    return () => {
      socketInstance.disconnect();
    };
  }, [gameId]);

  // --- RENDERING LOGIC ---

  // State A: Still connecting to the WebSocket server
  if (!role || !socket) {
    return (
      <Center h="100vh">
        <Group>
          <Loader color="blue" type="bars" />
          <Text size="xl" fw={500}>Entering BattleGround {gameId}...</Text>
        </Group>
      </Center>
    );
  }

  // State B: The room already has 2 people in it
  if (role === 'spectator') {
    return (
      <Center h="100vh">
        <Text size="xl" c="dimmed">The room is full. You are spectating.</Text>
      </Center>
    );
  }

  // State C: Successfully joined as a player! Render the correct layout.
  return (
    <>
      {role === 'coder' && <CoderPOV socket={socket} roomId={gameId} />}
      {role === 'tester' && <TesterPOV socket={socket} roomId={gameId} />}
    </>
  );
}
