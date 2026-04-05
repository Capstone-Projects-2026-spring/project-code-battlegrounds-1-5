import { useState } from "react";
import { Center, Stack, Button, Text, Group, Badge, Title } from "@mantine/core";
import { Role } from "@prisma/client";
import { usePostHog } from "posthog-js/react";
import styles from '@/styles/comps/TeamSelect.module.css';

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
        <Center className={styles.container}>
            <Stack align="center" gap="xl" className={styles.content}>
                <Title order={3} className={styles.title}>Choose a team</Title>
                <Text className={styles.roomId}>Room ID: {gameRoomId}</Text>
                <Group className={styles.teamsGroup}>
                    {teams.map((team, i) => {
                        const isFull = team.playerCount >= 2;
                        return (
                            <div key={team.teamId} className={`${styles.teamCard} ${isFull ? styles.disabled : ''}`}>
                                <Button
                                    data-testid={`team-${i + 1}-button`}
                                    variant="light"
                                    color="console"
                                    size="lg"
                                    disabled={isFull}
                                    loading={loading === team.teamId}
                                    onClick={() => handleJoin(team.teamId)}
                                    className={styles.teamButton}
                                >
                                    Team {i + 1}
                                </Button>
                                <Text data-testid={`team-${i + 1}-count`} className={styles.playerCount}>
                                    {team.playerCount} / 2
                                </Text>
                                {isFull && (
                                    <Badge 
                                        data-testid={`team-${i + 1}-full`} 
                                        color="red" 
                                        size="sm"
                                        className={styles.fullBadge}
                                    >
                                        Full
                                    </Badge>
                                )}
                            </div>
                        );
                    })}
                    <Button
                        data-testid="spectator-button"
                        size="lg"
                        variant="outline"
                        className={styles.spectatorButton}
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