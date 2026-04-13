import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { io, Socket } from 'socket.io-client';
import {
  Button,
  Center,
  Group,
  Loader,
  Tabs,
  SegmentedControl,
  Text,
  Card,
  Title,
  Container,
  Box,
  Stack,
  Badge,
  ThemeIcon,
} from '@mantine/core';
import { IconUsers, IconUser, IconTrophy } from '@tabler/icons-react';
import { GameType, ProblemDifficulty } from '@prisma/client';
import { authClient } from '@/lib/auth-client';
import { usePostHog } from 'posthog-js/react';
import DifficultySection from '@/components/home/DifficultySection';
import classes from '@/styles/Matchmaking.module.css';

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

  const partyId = (router.query.partyId as string) ?? null; // TODO: this is a bit hacky, we should have a proper lobby component ideally throughout the app instead of just a query param

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session?.user.id) return;
    if (socketRef.current) return;

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
        <Container size="md" py={60}>
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
              <Card
                withBorder
                shadow="md"
                radius="lg"
                padding="xl"
                className={classes.mainCard}
              >
                <Stack gap="xl">
                  {/* Game Mode Selection */}
                  <Box>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600}>Game Mode</Text>
                    </Group>
                    <SegmentedControl
                      data-testid="mode-control"
                      fullWidth
                      size="md"
                      value={gameType}
                      onChange={(val) => setGameType(val as GameType)}
                      disabled={status === 'queued' || status === 'matched'}
                      data={[
                        {
                          label: (
                            <Center style={{ gap: 8 }}>
                              <IconUser size={16} />
                              <span>Co-Op</span>
                            </Center>
                          ),
                          value: GameType.TWOPLAYER
                        },
                        {
                          label: (
                            <Center style={{ gap: 8 }}>
                              <IconUsers size={16} />
                              <span>2v2</span>
                            </Center>
                          ),
                          value: GameType.FOURPLAYER
                        },
                      ]}
                      className={classes.segmentedControl}
                    />
                  </Box>

                  {/* Difficulty Selection */}
                  <Box>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600}>Difficulty</Text>
                    </Group>
                    <SegmentedControl
                      fullWidth
                      size="md"
                      value={difficulty}
                      onChange={(val) => setDifficulty(val as ProblemDifficulty)}
                      disabled={status === 'queued' || status === 'matched'}
                      data={Object.values(ProblemDifficulty).map((value) => ({
                        label: difficultyLabels[value],
                        value,
                      }))}
                      className={classes.segmentedControl}
                    />
                  </Box>

                  {/* Party ID Badge */}
                  {partyId && (
                    <Badge
                      size="lg"
                      variant="light"
                      color="blue"
                      leftSection={<IconUsers size={14} />}
                    >
                      Queueing with lobby
                    </Badge>
                  )}

                  {/* Status Display */}
                  {status === 'queued' && (
                    <Card withBorder padding="md" className={classes.statusCard}>
                      <Stack gap="md">
                        <Group justify="space-between">
                          <Group gap="sm">
                            <Loader size="sm" />
                            <Text fw={500}>Searching for opponents...</Text>
                          </Group>
                        </Group>
                      </Stack>
                    </Card>
                  )}

                  {status === 'matched' && (
                    <Card withBorder padding="md" className={classes.successCard}>
                      <Stack gap="sm" align="center">
                        <ThemeIcon size={48} radius="xl" color="green" variant="light">
                          <IconTrophy size={24} />
                        </ThemeIcon>
                        <Text fw={600} size="lg" c="green">Match Found!</Text>
                        <Text size="sm" c="dimmed">Preparing your battle arena...</Text>
                        <Loader size="sm" color="green" />
                      </Stack>
                    </Card>
                  )}

                  {status === 'error' && (
                    <Card withBorder padding="md" className={classes.errorCard}>
                      <Text c="red" ta="center" fw={500}>
                        ⚠️ Something went wrong. Please try again.
                      </Text>
                    </Card>
                  )}

                  {/* Action Button */}
                  {status === 'idle' || status === 'error' ? (
                    <Button
                      fullWidth
                      size="lg"
                      radius="md"
                      onClick={handleJoinQueue}
                      className={classes.primaryButton}
                    >
                      {partyId ? 'Queue with Lobby' : 'Find Match'}
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      size="lg"
                      radius="md"
                      color="red"
                      variant="outline"
                      onClick={handleLeaveQueue}
                      disabled={status === 'matched'}
                      className={classes.cancelButton}
                    >
                      Cancel Search
                    </Button>
                  )}
                </Stack>
              </Card>
            </Tabs.Panel>

            <Tabs.Panel value="create-game" pt="md">
              <Card
                withBorder
                shadow="sm"
                radius="lg"
                padding="xl"
                className={classes.instantCard}
              >
                <DifficultySection />
              </Card>
            </Tabs.Panel>
          </Tabs>

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
