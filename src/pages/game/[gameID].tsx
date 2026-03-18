import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Center, Loader, Text, Group } from '@mantine/core';
import { io, Socket } from 'socket.io-client';
import { authClient } from '@/lib/auth-client'
import { Role, GameStatus } from '@prisma/client';

import CoderPOV from '@/components/coderPOV';
import TesterPOV from '@/components/testerPOV';
import SpectatorPOV from '@/components/spectatorPOV';
import TeamSelect from '@/components/TeamSelect';
import { TeamCount } from '@/components/TeamSelect';

export default function PlayGameRoom() {
  // 1. Grab the ID from the URL (e.g., "624")
  const router = useRouter();
  const gameId = router.query.gameID as string;

  const { data: session, error, isPending } = authClient.useSession() // auth check still needs some work to make work correct

  // 2. Set up our state for the socket connection and the user's role
  const [role, setRole] = useState<Role | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameStatus>(GameStatus.WAITING);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [teams, setTeams] = useState<TeamCount[]>([]);
  const [teamSelected, setTeamSelected] = useState<string | null>(null);

  // ONLY HAPPENS ON PAGE LAUNCH
  useEffect(() => {
    if (!session?.user.id) return;
    if (!gameId) return;

    // fetch teams and their player counts
    const fetchCounts = async () => {
        const res = await fetch(`/api/team/count?gameId=${gameId}`);
        const data = await res.json();
        setTeams(data.teams);
    };
    fetchCounts();

    // 3. Initialize the connection to our custom server.js backend
    const socketInstance = io();
    setSocket(socketInstance);
    socketInstance.emit('register', session.user.id); 

    socketInstance.on('gameStarting', () => {
      setGameState(GameStatus.STARTING);
    })

    socketInstance.on('gameStarted', ({ start, _duration }) => {
      if (isNaN(start) || isNaN(_duration)) return;
      setTimeRemaining(Number(start));
      setDuration(Number(_duration));
      setGameState(GameStatus.ACTIVE);
    });

    socketInstance.on("gameEnded", () => {
      setGameState(GameStatus.FINISHED);
    });

    // This is so if another person picks while someone is deciding
    socketInstance.on('teamUpdated', ({ teamId, playerCount }) => {
        setTeams(prev => prev.map(t =>
            t.teamId === teamId ? { ...t, playerCount } : t
        ));
    });

    // 6. Cleanup: disconnect the socket if the user leaves the page
    return () => {
      socketInstance.disconnect();
    };
  }, [gameId, session?.user.id]);

  useEffect(() => {
    // Runs after team gets selected
    console.log('Effect 2:', { socket: !!socket, teamSelected, gameId });
    if (!socket || !teamSelected || !gameId) return;
    socket.emit('joinGame', { gameId, teamId: teamSelected });
  }, [socket, teamSelected, gameId])

  // --- RENDERING LOGIC ---
  if (isPending) {
    return (
      <Center>
        Nope
      </Center>
    )
  }

  if (!teamSelected && role !== Role.SPECTATOR) {
    return (
      <TeamSelect
          userId={session?.user.id as string}
          teams={teams}
          gameRoomId={gameId}
          onJoined={(teamId, role) => {
            setTeamSelected(teamId);
            setGameState(GameStatus.WAITING);
            setRole(role) // Maybe add localStorage persistence
            if (role === Role.SPECTATOR) {
              setGameState(GameStatus.ACTIVE);
            }
          }}
      />
    )
  }

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

  if (gameState == GameStatus.STARTING) {
    return (
      <Center>Starting...3...2...1...!</Center>
    )
  }

  if (gameState === GameStatus.WAITING) {
    return (
      <Center h="100vh">
        <Text size="xl" c="dimmed">Waiting for another player to join...</Text>
      </Center>
    );
  }

  // State B: The room already has 2 people in it
  if (role === Role.SPECTATOR) {
    return (
      <SpectatorPOV
        socket={socket}
        teams={teams}
        timeRemaining={timeRemaining}
        duration={duration}
        gameState={gameState}
      />
    );
  }

  // State C: Successfully joined as a player! Render the correct layout.
  return (
    <>
      {role === Role.CODER && teamSelected && (
        <CoderPOV
          socket={socket}
          roomId={teamSelected}
          timeRemaining={timeRemaining}
          duration={duration}
          gameState={gameState}
        />
      )}
      {role === Role.TESTER && teamSelected && (
        <TesterPOV
          socket={socket}
          roomId={teamSelected}
          timeRemaining={timeRemaining}
          duration={duration}
          gameState={gameState}
        />
      )}
    </>
  );
}
