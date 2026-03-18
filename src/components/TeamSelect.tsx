import { useState, useEffect } from "react"
import { Center, Stack, Button, Text, Group, Badge, Title } from "@mantine/core";
import { Role } from "@prisma/client";

export interface TeamCount {
    teamId: string;
    playerCount: number;
}

interface TeamSelectProps {
    userId: string;
    teams: TeamCount[];
    gameRoomId: string;
    onJoined: (teamId: string | null, role: Role) => void;
}

export default function TeamSelect({ userId, teams, gameRoomId, onJoined }: TeamSelectProps) {
    const [loading, setLoading] = useState<string | null>(null);

    useEffect(() => {
        if (!gameRoomId || !userId) return;
        const checkExisting = async () => {
            const res = await fetch(`/api/team/existing?gameRoomId=${gameRoomId}&userId=${userId}`);
            const data = await res.json();
            if (data.teamId) {
                onJoined(data.teamId, data.role); // skip TeamSelect entirely on reconnect
            }
        }
        checkExisting();
    }, [gameRoomId, userId]);

    const handleJoin = async (teamId: string) => {
        setLoading(teamId);
        const res = await fetch(`/api/team/join`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, teamId, gameRoomId })
        });

        if (res.ok) {
            const data = await res.json();
            onJoined(teamId, data.role);
        }
        setLoading(null);
    };

    return (
        <Center h="100vh">
            <Stack align="center" gap="xl">
                <Title order={3}>Choose a team</Title>
                <Group gap="md">
                    {teams.map((team, i) => {
                        const isFull = team.playerCount >= 2;
                        return (
                            <Stack key={team.teamId} align="center" gap="xs">
                                <Button
                                    variant="default"
                                    disabled={isFull}
                                    loading={loading === team.teamId}
                                    onClick={() => handleJoin(team.teamId)}
                                >
                                    Team {i + 1}
                                </Button>
                                <Text size="sm" c="dimmed">{team.playerCount} / 2</Text>
                                {isFull && <Badge color="red" size="sm">Full</Badge>}
                            </Stack>
                        );
                    })}
                    <Button
                        onClick={() => { onJoined(null, Role.SPECTATOR) }}
                    >
                        Spectator Mode
                    </Button>
                </Group>
            </Stack>
        </Center>
    );
}