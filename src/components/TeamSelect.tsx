import { useState } from "react";
import { Center, Stack, Button, Text, Group, Badge, Title } from "@mantine/core";
import { Role } from "@prisma/client";
import { usePostHog } from "posthog-js/react";

export interface TeamCount {
    teamId: string;
    playerCount: number;
}

interface TeamSelectProps {
    userId: string;
    teams: TeamCount[];
    gameRoomId: string;
    onJoined: (teamId: string | null, role: Role, playerCount: number | null) => void;
}

export default function TeamSelect({ userId, teams, gameRoomId, onJoined }: TeamSelectProps) {
    const posthog = usePostHog();
    const [loading, setLoading] = useState<string | null>(null);

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
                        onClick={() => { 
                            posthog.capture("spectator_joined", {
                                gameId: gameRoomId
                            });
                            onJoined(null, Role.SPECTATOR, null);
                         }}
                    >
                        Spectator Mode
                    </Button>
                </Group>
            </Stack>
        </Center>
    );
}