import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
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
import { useMatchmaking } from '@/contexts/MatchmakingContext';
import { useParty } from '@/contexts/PartyContext';
import { useSocket } from '@/contexts/SocketContext';
import classes from '@/styles/Matchmaking.module.css';
import dynamic from 'next/dynamic';

const DifficultySection = dynamic(() => import("@/components/home/DifficultySection"));
const JoinGameSection = dynamic(() => import("@/components/home/JoinGameSection"));
// const FindLobbySection = dynamic(() => import("@/components/home/FindLobbySection"));
// Not dynamic since it's being rendered immediately
import FindLobbySection from '@/components/home/FindLobbySection';

export default function QueuePage() {
  const posthog = usePostHog();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const { socket } = useSocket();

  const {
    status,
    setStatus,
    gameType,
    setGameType,
    difficulty,
    setDifficulty,
    activeTab,
    setActiveTab
  } = useMatchmaking();

  const { joinedParty, partyMember, partyCode } = useParty();

  // Tracks what the user actually queued for so leaveQueue cancels the right one
  const queuedSelectionRef = useRef<{ gameType: GameType; difficulty: ProblemDifficulty } | null>(null);

  const handleTabChange = (value: string | null) => {
    if (!value) return;

    // Only the leader (non-joined party member) can change tabs
    if (joinedParty !== null) return;

    setActiveTab(value);

    // Broadcast to party if in one
    if (socket && partyMember) {
      socket.emit("updateQueueSelection", {
        gameType,
        difficulty,
        partyMember,
        activeTab: value,
      });
    }
  };

  // TODO: pull from PartyContext once party member is wired up
  const inParty = partyMember !== null || joinedParty !== null;
  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [isPending, session, router]);

  const handleJoinQueue = () => {
    if (!socket || !session?.user.id) return;
    queuedSelectionRef.current = { gameType, difficulty };
    setStatus('queued');
    posthog.capture('user_joined_queue', { gameType, difficulty });
    socket.emit('partySearch', { partyMember, state: 'queued' });
    socket.emit('joinQueue', {
      userId: session.user.id,
      gameType,
      difficulty,
      partyId: partyMember ? partyCode : null,
    });
  };

  const handleLeaveQueue = () => {
    if (!socket || !queuedSelectionRef.current) return;
    posthog.capture('user_left_queue', { gameType, difficulty });
    socket.emit('partySearch', { partyMember, state: 'idle' });
    socket.emit('leaveQueue', {
      gameType: queuedSelectionRef.current.gameType,
      difficulty: queuedSelectionRef.current.difficulty,
    });
    queuedSelectionRef.current = null;
    setStatus('idle');
  };

  // Sync full state when someone joins your party
  useEffect(() => {
    if (!socket) return;

    const handleMemberJoined = () => {
      // Leader pushes current state to new joiner
      if (joinedParty === null && partyMember) {
        socket.emit("updateQueueSelection", {
          gameType,
          difficulty,
          partyMember,
          activeTab,
        });
      }
    };

    socket.on("partyMemberJoined", handleMemberJoined);
    return () => { 
      socket.off("partyMemberJoined", handleMemberJoined); 
    };
  }, [socket, joinedParty, partyMember, gameType, difficulty, activeTab]);

  if (isPending) {
    return (
      <>
        <Head>
          <title>Matchmaking - Code Battlegrounds</title>
        </Head>
        <Center h="100vh">
          <Stack gap="md" align="center">
            <Loader color="blue" size="lg" type="dots" />
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

          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tabs.List grow>
              <Tabs.Tab
                value="create-game"
                data-testid="create-game-tab"
                className={classes.modeTab}
                disabled={joinedParty !== null}
              >
                Create Game
              </Tabs.Tab>
              <Tabs.Tab
                value="matchmaking"
                data-testid="matchmaking-tab"
                className={classes.modeTab}
                disabled={joinedParty !== null}
              >
                Matchmaking
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="create-game" pt="md">
              <DifficultySection />
            </Tabs.Panel>

            <Tabs.Panel value="matchmaking" pt="md">
              <FindLobbySection
                gameType={gameType}
                difficulty={difficulty}
                status={status}
                inParty={inParty}
                difficultyLabels={difficultyLabels}
                onGameTypeChange={setGameType}
                onDifficultyChange={setDifficulty}
                onJoinQueue={handleJoinQueue}
                onLeaveQueue={handleLeaveQueue}
              />
            </Tabs.Panel>

          </Tabs>

          <JoinGameSection disabled={inParty} />

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