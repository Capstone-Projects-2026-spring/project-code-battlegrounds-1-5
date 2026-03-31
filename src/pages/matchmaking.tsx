import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { io, Socket } from 'socket.io-client';
import { Button, Center, Group, Loader, Select, SegmentedControl, Text, Card } from '@mantine/core';
import { GameType, ProblemDifficulty } from '@prisma/client';
import { authClient } from '@/lib/auth-client';

type QueueStatus = 'idle' | 'queued' | 'matched' | 'error';

export default function QueuePage() {
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
            router.push('/auth');
        }
    }, [isPending, session, router]);

    useEffect(() => {
        if (!session?.user.id) return;
        if (socketRef.current) return;

        const socketInstance = io();
        socketRef.current = socketInstance;
        setSocket(socketRef.current);

        socketInstance.emit('register', session.user.id);

        socketInstance.on('matchFound', ({ gameId }) => {
            setStatus('matched');
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
        socket.emit('joinQueue', {
            userId: session.user.id,
            gameType,
            difficulty,
            partyId,
        });
    };

    const handleLeaveQueue = () => {
        if (!socket || !queuedSelectionRef.current) return;
        socket.emit('leaveQueue', {
            gameType: queuedSelectionRef.current.gameType,
            difficulty: queuedSelectionRef.current.difficulty,
        });
        queuedSelectionRef.current = null;
        setStatus('idle');
    };

    if (isPending) {
        return (
            <Center h="100vh">
                <Loader color="blue" type="bars" />
            </Center>
        );
    }

    return (
        <Center h="100vh">
            <Card w={400} withBorder shadow="md">
                <Text size="xl" fw={700} mb="xl" ta="center">
                    Find a Match
                </Text>

                <Text size="sm" fw={500} mb="xs">Mode</Text>
                <SegmentedControl
                    data-testid="mode-control"
                    fullWidth
                    mb="md"
                    value={gameType}
                    onChange={(val) => setGameType(val as GameType)}
                    disabled={status === 'queued' || status === 'matched'}
                    data={[
                        { label: 'Co-Op', value: GameType.TWOPLAYER },
                        { label: '2v2', value: GameType.FOURPLAYER },
                    ]}
                />

                <Text size="sm" fw={500} mb="xs">Difficulty</Text>
                <Select
                    mb="xl"
                    value={difficulty}
                    onChange={(val) => setDifficulty(val as ProblemDifficulty)}
                    disabled={status === 'queued' || status === 'matched'}
                    data={Object.values(ProblemDifficulty).map(d => ({
                        label: d.charAt(0) + d.slice(1).toLowerCase(),
                        value: d,
                    }))}
                />

                {partyId && (
                    <Text size="sm" c="dimmed" mb="md" ta="center">
                        Queueing with lobby
                    </Text>
                )}

                {status === 'queued' && (
                    <Group justify="center" mb="md">
                        <Loader size="sm" color="blue" />
                        <Text c="dimmed">Searching for a match...</Text>
                    </Group>
                )}
                {status === 'matched' && (
                    <Group justify="center" mb="md">
                        <Loader size="sm" color="green" />
                        <Text c="green">Match found! Redirecting...</Text>
                    </Group>
                )}
                {status === 'error' && (
                    <Text c="red" ta="center" mb="md">
                        Something went wrong. Please try again.
                    </Text>
                )}

                {status === 'idle' || status === 'error' ? (
                    <Button fullWidth onClick={handleJoinQueue}>
                        {partyId ? 'Queue with Lobby' : 'Find Match'}
                    </Button>
                ) : (
                    <Button
                        fullWidth
                        color="red"
                        variant="outline"
                        onClick={handleLeaveQueue}
                        disabled={status === 'matched'}
                    >
                        Cancel
                    </Button>
                )}
            </Card>
        </Center>
    );
}