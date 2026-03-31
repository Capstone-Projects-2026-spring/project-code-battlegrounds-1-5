import { useState, useEffect } from "react";
import { Center, Stack, Button, Text, Group, Badge, Title } from "@mantine/core";
import { GameType, Role } from "@prisma/client";

export interface TeamCount {
    teamId: string;
    playerCount: number;
}

interface TeamSelectProps {
    userId: string;
    teams: TeamCount[];
    gameRoomId: string;
    gameType: GameType;
    onJoined: (teamId: string | null, role: Role, playerCount: number | null) => void;
}

export default function TeamSelect({ userId, teams, gameType, gameRoomId, onJoined }: TeamSelectProps) {
    const [loading, setLoading] = useState<string | null>(null);

    useEffect(() => {
        if (!gameRoomId || !userId || !teams) return;
        if (gameType === GameType.TWOPLAYER) {
            const teamId = teams[0]?.teamId;
            if (!teamId) return;
            fetch(`/api/team/join`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, teamId, gameRoomId })
            }).then(r => r.json()).then(data => {
                onJoined(teamId, data.role, data.playerCount);
            }).catch(() => {
                onJoined(null, Role.SPECTATOR, null);
            });
            return;
        }
        const checkExisting = async () => {
            const res = await fetch(`/api/team/existing?gameRoomId=${gameRoomId}&userId=${userId}`);
            const data = await res.json();
            if (data.teamId) {
                onJoined(data.teamId, data.role, null); // skip TeamSelect entirely on reconnect
            }
        };
        checkExisting();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameRoomId, userId, gameType, teams]);

    const handleJoin = async (teamId: string) => {
        setLoading(teamId);
        const res = await fetch(`/api/team/join`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, teamId, gameRoomId })
        });

        if (res.ok) {
            const data = await res.json();
            onJoined(teamId, data.role, data.playerCount);;
        }
        setLoading(null);
    };

    return (
        <Center h="100vh">
            <Stack align="center" gap="xl">
                <Title order={3}>Choose a team</Title>
                <Text size="md" fw={600}>Room ID: {gameRoomId}</Text>
                <Group gap="md">
                    {teams.map((team, i) => {
                        const isFull = team.playerCount >= 2;
                        return (
                            <Stack key={team.teamId} align="center" gap="xs">
                                <Button
                                    data-testid={`team-${i + 1}-button`}
                                    variant="default"
                                    disabled={isFull}
                                    loading={loading === team.teamId}
                                    onClick={() => handleJoin(team.teamId)}
                                >
                                    Team {i + 1}
                                </Button>
                                <Text data-testid={`team-${i + 1}-count`} size="sm" c="dimmed">{team.playerCount} / 2</Text>
                                {isFull && <Badge data-testid={`team-${i + 1}-full`} color="red" size="sm">Full</Badge>}
                            </Stack>
                        );
                    })}
                    <Button
                        data-testid="spectator-button"
                        onClick={() => { onJoined(null, Role.SPECTATOR, null); }}
                    >
                        Spectator Mode
                    </Button>
                </Group>
            </Stack>
        </Center>
    );
}