import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
  Box,
} from "@mantine/core";
import { IconTrophy, IconUser, IconUsers } from "@tabler/icons-react";
import { GameType, ProblemDifficulty } from "@prisma/client";
import classes from "@/styles/Matchmaking.module.css";

type QueueStatus = "idle" | "queued" | "matched" | "error";

type FindLobbySectionProps = {
  gameType: GameType;
  difficulty: ProblemDifficulty;
  status: QueueStatus;
  partyId: string | null;
  difficultyLabels: Record<ProblemDifficulty, string>;
  onGameTypeChange: (gameType: GameType) => void;
  onDifficultyChange: (difficulty: ProblemDifficulty) => void;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
};

export default function FindLobbySection({
  gameType,
  difficulty,
  status,
  partyId,
  difficultyLabels,
  onGameTypeChange,
  onDifficultyChange,
  onJoinQueue,
  onLeaveQueue,
}: FindLobbySectionProps) {
  return (
    <Card
      withBorder
      shadow="md"
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
            onChange={(val) => onGameTypeChange(val as GameType)}
            disabled={status === "queued" || status === "matched"}
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

        {/* Difficulty Selection */}
        <Box>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600}>Difficulty</Text>
          </Group>
          <SegmentedControl
            fullWidth
            size="md"
            value={difficulty}
            onChange={(val) => onDifficultyChange(val as ProblemDifficulty)}
            disabled={status === "queued" || status === "matched"}
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
        {status === "queued" && (
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

        {status === "matched" && (
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

        {status === "error" && (
          <Card withBorder padding="md" className={classes.errorCard}>
            <Text c="red" ta="center" fw={500}>
              ⚠️ Something went wrong. Please try again.
            </Text>
          </Card>
        )}

        {/* Action Button */}
        {status === "idle" || status === "error" ? (
          <Button
            fullWidth
            size="lg"
            radius="md"
            onClick={onJoinQueue}
            className={classes.primaryButton}
          >
            {partyId ? "Queue with Lobby" : "Find Match"}
          </Button>
        ) : (
          <Button
            fullWidth
            size="lg"
            radius="md"
            color="red"
            variant="outline"
            onClick={onLeaveQueue}
            disabled={status === "matched"}
            className={classes.cancelButton}
          >
            Cancel Search
          </Button>
        )}
      </Stack>
    </Card>
  );
}
