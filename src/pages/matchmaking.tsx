import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { io, Socket } from 'socket.io-client';
import {
  Center,
  Loader,
  Tabs,
  Text,
  Title,
  Container,
  Box,
  Stack,
} from '@mantine/core';
import { GameType, ProblemDifficulty } from '@prisma/client';
import { authClient } from '@/lib/auth-client';
import { usePostHog } from 'posthog-js/react';
import classes from '@/styles/Matchmaking.module.css';
import dynamic from 'next/dynamic';

const DifficultySection = dynamic(() => import("@/components/home/DifficultySection"));
const JoinGameSection = dynamic(() => import("@/components/home/JoinGameSection"));
// const FindLobbySection = dynamic(() => import("@/components/home/FindLobbySection"));
// Not dynamic since it's being rendered immediately
import FindLobbySection from '@/components/home/FindLobbySection';

type QueueStatus = 'idle' | 'queued' | 'matched' | 'error';

export default function QueuePage() {
  const posthog = usePostHog();

  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [gameType, setGameType] = useState<GameType>(GameType.TWOPLAYER);
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>(ProblemDifficulty.MEDIUM);
  const [status, setStatus] = useState<QueueStatus>('idle');

  // Tracks what the user actually queued for so leaveQueue cancels the right one
  const queuedSelectionRef = useRef<{ gameType: GameType; difficulty: ProblemDifficulty } | null>(null);

  const partyId = (router.query.partyId as string) ?? null; 
  // TODO: this is a bit hacky, we should have a proper lobby component ideally throughout the app instead of just a query param

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session?.user.id || socketRef.current) return;

    const socketInstance = io();
    socketRef.current = socketInstance;
    setSocket(socketRef.current);

    socketInstance.emit('register', { userId: session.user.id });

    socketInstance.on('matchFound', ({ gameId }) => {
      setStatus('matched');
      posthog.capture("match_found", {
        gameId,
        gameType,
        difficulty
      });
      router.push({
        pathname: `/game/${gameId}`,
      });
    });

    socketInstance.on('queueStatus', ({ status: queueStatus, error }) => {
      if (error) {
        setStatus('error');
        return;
      }
      if (queueStatus === 'already_queued') setStatus('queued');
      if (queueStatus === 'queued') setStatus('queued');
      if (queueStatus === 'matched') setStatus('matched');
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const handleJoinQueue = () => {
    if (!socket || !session?.user.id) return;
    queuedSelectionRef.current = { gameType, difficulty };
    setStatus('queued');
    posthog.capture("user_joined_queue", {
      gameType,
      difficulty
    });
    socket.emit('joinQueue', {
      userId: session.user.id,
      gameType,
      difficulty,
      partyId,
    });
  };

  const handleLeaveQueue = () => {
    if (!socket || !queuedSelectionRef.current) return;
    posthog.capture("user_left_queue", {
      gameType,
      difficulty
    });
    socket.emit('leaveQueue', {
      gameType: queuedSelectionRef.current.gameType,
      difficulty: queuedSelectionRef.current.difficulty,
    });
    queuedSelectionRef.current = null;
    setStatus('idle');
  };

  if (isPending) {
    return (
      <>
        <Head>
          <title>Matchmaking - Code Battlegrounds</title>
        </Head>
        <Center h="100vh">
          <Stack gap="md" align="center">
            <Loader size="lg" type="dots" />
            <Text c="dimmed">Loading matchmaking...</Text>
          </Stack>
        </Center>
      </>
    );
  }

  const difficultyLabels = {
    [ProblemDifficulty.EASY]: 'Beginner',
    [ProblemDifficulty.MEDIUM]: 'Intermediate',
    [ProblemDifficulty.HARD]: 'Advanced',
  };

  return (
    <>
      <Head>
        <title>Find a Match - Code Battlegrounds</title>
        <meta name="description" content="Find opponents through matchmaking or create an instant room by difficulty" />
      </Head>

      <Box className={classes.matchmakingPage}>
        <Container
          display="flex"
          size="md"
          py={60}
          style={{
            flexDirection: "column",
            gap: 20
          }}
        >
          {/* Header Section */}
          <Stack gap="xl" mb={60} className={classes.header}>
            <Box ta="center">
              <Title
                order={1}
                size="h1"
                mb="md"
                className={classes.title}
              >
                Find Your Match
              </Title>
              <Text c="dimmed" maw={560} mx="auto">
                Queue up for a balanced match, or spin up an instant room at your preferred challenge level.
              </Text>
            </Box>
          </Stack>

          <Tabs defaultValue="matchmaking">
            <Tabs.List grow>
              <Tabs.Tab
                value="matchmaking"
                data-testid="matchmaking-tab"
                className={classes.modeTab}
              >
                Find a Lobby
              </Tabs.Tab>
              <Tabs.Tab
                value="create-game"
                data-testid="create-game-tab"
                className={classes.modeTab}
              >
                Create Game
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="matchmaking" pt="md">
              <FindLobbySection
                gameType={gameType}
                difficulty={difficulty}
                status={status}
                partyId={partyId}
                difficultyLabels={difficultyLabels}
                onGameTypeChange={setGameType}
                onDifficultyChange={setDifficulty}
                onJoinQueue={handleJoinQueue}
                onLeaveQueue={handleLeaveQueue}
              />
            </Tabs.Panel>

            <Tabs.Panel value="create-game" pt="md">
              <DifficultySection />
            </Tabs.Panel>
          </Tabs>

          <JoinGameSection />

          {/* Help Text */}
          <Text size="sm" c="dimmed" ta="center" mt="xl">
            New to Code Battlegrounds?{' '}
            <Text
              component="a"
              href="/"
              c="blue"
              style={{ textDecoration: 'underline', cursor: 'pointer' }}
            >
              Learn how it works
            </Text>
          </Text>
        </Container>

        {/* Animated background gradient */}
        <div className={classes.gradient} aria-hidden="true" />
      </Box>
    </>
  );
}
