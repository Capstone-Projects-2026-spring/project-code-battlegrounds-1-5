'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation'; // <-- Allows us read dynamic folder names.
import { Center, Loader, Text, Group } from '@mantine/core';
import { io, Socket } from 'socket.io-client';

import CoderPOV from '@/components/coderPOV';
import TesterPOV from '@/components/testerPOV';
import SpectatorPOV from '@/components/spectatorPOV';

export default function PlayGameRoom() {
  // 1. Grab the ID from the URL (e.g., "624")
  const params = useParams();
  const gameId = params.gameID as string;

  // 2. Set up our state for the socket connection and the user's role
  const [role, setRole] = useState<'coder' | 'tester' | 'spectator' | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // ONLY HAPPENS ON PAGE LAUNCH
  useEffect(() => {
    // 3. Initialize the connection to our custom server.js backend
    const socketInstance = io(); 
    setSocket(socketInstance);

    // 4. Wait for the server to reply with our role (coder, tester, or spectator)
    // The server assigns a role before letting the user join the game room, so we should get this info immediately after connecting
    socketInstance.on('roleAssigned', (assignedRole) => {
      setRole(assignedRole);
    });

    // 5. Ask the server to put us in the room for this specific game
    // sends a signal to the server that we want to join a specific game room, identified by gameId
    socketInstance.emit('joinGame', gameId);

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
    return <SpectatorPOV socket={socket} roomId={gameId} />;
  }

  // State C: Successfully joined as a player! Render the correct layout.
  return (
    <>
      {role === 'coder' && <CoderPOV socket={socket} roomId={gameId} />}
      {role === 'tester' && <TesterPOV socket={socket} roomId={gameId} />}
    </>
  );
}