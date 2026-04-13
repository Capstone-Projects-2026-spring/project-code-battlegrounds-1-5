import { useRef } from 'react';
import Head from 'next/head';
import {
    Button,
    Center,
    Group,
    Loader,
    Select,
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
import { useMatchmaking } from '@/contexts/MatchmakingContext';
import { useParty } from '@/contexts/PartyContext';
import { useSocket } from '@/contexts/SocketContext';
import classes from '@/styles/Matchmaking.module.css';

export default function QueuePage() {
    const posthog = usePostHog();
    const { data: session, isPending } = authClient.useSession();

    const { socket } = useSocket();

    const {
        status,
        setStatus,
        gameType,
        setGameType,
        difficulty,
        setDifficulty,
        gameId,
    } = useMatchmaking();

    const { joinedParty, partyMember, partyCode } = useParty();

    // Tracks what the user actually queued for so leaveQueue cancels the right one
    const queuedSelectionRef = useRef<{ gameType: GameType; difficulty: ProblemDifficulty } | null>(null);

    // TODO: pull from PartyContext once party member is wired up
    const inParty = partyMember !== null || joinedParty !== null;


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
        socket.emit('partySearch', { partyMember, state : 'idle'});
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
                <meta name="description" content="Find your perfect pair programming partner and start competing" />
            </Head>

            <Box className={classes.matchmakingPage}>
                <Container size="sm" py={60}>
                    <Stack gap="xl" mb={60} className={classes.header}>
                        <Box ta="center">
                            <Title order={1} size="h1" mb="md" className={classes.title}>
                                Find Your Match
                            </Title>
                        </Box>
                    </Stack>

                    <Card withBorder shadow="md" radius="lg" padding="xl" className={classes.mainCard}>
                        <Stack gap="xl">

                            {/* Game Mode */}
                            <Box>
                                <Group justify="space-between" mb="xs">
                                    <Text size="sm" fw={600}>Game Mode</Text>
                                </Group>
                                <SegmentedControl
                                    data-testid="mode-control"
                                    fullWidth
                                    size="md"
                                    value={gameType}
                                    onChange={(val) => {
                                        if (partyMember) socket?.emit('updateQueueSelection', { gameType: val as GameType, difficulty, partyMember });
                                        setGameType(val as GameType);
                                    }}
                                    disabled={status === 'queued' || status === 'matched' || joinedParty !== null }
                                    data={[
                                        {
                                            label: (
                                                <Center style={{ gap: 8 }}>
                                                    <IconUser size={16} />
                                                    <span>Co-Op</span>
                                                </Center>
                                            ),
                                            value: GameType.TWOPLAYER,
                                        },
                                        {
                                            label: (
                                                <Center style={{ gap: 8 }}>
                                                    <IconUsers size={16} />
                                                    <span data-testid="mode-2v2">2v2</span>
                                                </Center>
                                            ),
                                            value: GameType.FOURPLAYER,
                                        },
                                    ]}
                                    className={classes.segmentedControl}
                                />
                            </Box>

                            {/* Difficulty */}
                            <Box>
                                <Group justify="space-between" mb="xs">
                                    <Text size="sm" fw={600}>Difficulty</Text>
                                </Group>
                                <Select
                                    size="md"
                                    value={difficulty}
                                    onChange={(val) => {
                                        if (partyMember) socket?.emit('updateQueueSelection', { gameType, difficulty: val as ProblemDifficulty, partyMember });
                                        setDifficulty(val as ProblemDifficulty);
                                    }}
                                    disabled={status === 'queued' || status === 'matched' || joinedParty !== null }
                                    data={Object.values(ProblemDifficulty).map((d) => ({
                                        label: difficultyLabels[d],
                                        value: d,
                                    }))}
                                    styles={{ input: { fontWeight: 500 } }}
                                />
                            </Box>

                            {/* Party badge — TODO: replace partyId with PartyContext */}
                            {inParty && (
                                <Badge size="lg" variant="light" color="blue" leftSection={<IconUsers size={14} />}>
                                    Queueing with lobby
                                </Badge>
                            )}

                            {/* Status */}
                            {status === 'queued' && (
                                <Card withBorder padding="md" className={classes.statusCard}>
                                    <Stack gap="md">
                                        <Group gap="sm">
                                            <Loader size="sm" />
                                            <Text fw={500}>Searching for opponents...</Text>
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
                                        <Text size="sm" c="dimmed">Preparing your battle arena... {gameId}</Text>
                                        <Loader size="sm" color="green" />
                                    </Stack>
                                </Card>
                            )}

                            {status === 'error' && (
                                <Card withBorder padding="md" className={classes.errorCard}>
                                    <Text c="red" ta="center" fw={500}>
                                        Something went wrong. Please try again.
                                    </Text>
                                </Card>
                            )}

                            {/* Action */}
                            {status === 'idle' || status === 'error' ? (
                                <Button
                                    fullWidth
                                    size="lg"
                                    radius="md"
                                    onClick={handleJoinQueue}
                                    disabled={joinedParty !== null}
                                    className={classes.primaryButton}
                                >
                                    {inParty ? 'Queue with Lobby' : 'Find Match'}
                                </Button>
                            ) : (
                                <Button
                                    fullWidth
                                    size="lg"
                                    radius="md"
                                    color="red"
                                    variant="outline"
                                    onClick={handleLeaveQueue}
                                    disabled={status === 'matched' || joinedParty !== null}
                                    className={classes.cancelButton}
                                >
                                    Cancel Search
                                </Button>
                            )}
                        </Stack>
                    </Card>

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

                <div className={classes.gradient} aria-hidden="true" />
            </Box>
        </>
    );
}