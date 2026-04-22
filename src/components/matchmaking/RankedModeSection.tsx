import { Badge, Box, Group, Progress, Stack, Text } from "@mantine/core";
import { RANK_DEFINITIONS, getRankForElo } from "@/lib/ranks";
import { RankBadge } from "./RankedBadge";
import { useMatchmaking } from "@/contexts/MatchmakingContext";

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function RankedModeSection() {
  const { elo } = useMatchmaking();
  const rank = getRankForElo(elo);
  const isTopTier = rank.eloMax === Number.MAX_SAFE_INTEGER;

  const eloIntoTier = elo - rank.eloMin;
  const tierSpan = isTopTier ? 400 : rank.eloMax - rank.eloMin;
  const progress = Math.min((eloIntoTier / tierSpan) * 100, 100);
  const toNext = isTopTier ? null : rank.eloMax - elo + 1;

  return (
    <Stack gap="md">
      {/* Header row */}
      <Group justify="space-between" mb={0}>
        <Text size="sm" fw={600}>
          Rank
        </Text>
        <Badge
          size="sm"
          variant="light"
          style={{
            background: hexAlpha(rank.color, 0.1),
            border: `1px solid ${hexAlpha(rank.color, 0.4)}`,
            color: rank.color,
            fontFamily: "monospace",
            letterSpacing: "0.07em",
          }}
        >
          {rank.id === "null" ? "UNRANKED" : `${rank.label} TIER`}
        </Badge>
      </Group>

      {/* Badge ladder — not clickable */}
      <Group justify="space-between" gap={4} wrap="nowrap">
        {RANK_DEFINITIONS.map((r) => (
          <RankBadge
            key={r.id}
            rank={r}
            size="sm"
            active={r.id === rank.id}
          />
        ))}
      </Group>

      {/* ELO + progress */}
      <Box
        p="md"
        style={{
          background: "var(--mantine-color-dark-7)",
          border: "1px solid var(--mantine-color-dark-4)",
          borderRadius: "var(--mantine-radius-md)",
        }}
      >
        <Stack gap="xs">
          {/* ELO value row */}
          <Group justify="space-between" align="flex-end">
            <Text size="xs" c="dimmed" ff="monospace" style={{ letterSpacing: "0.1em" }}>
              ELO RATING
            </Text>
            <Group gap={4} align="baseline">
              <Text
                ff="monospace"
                fw={800}
                style={{
                  fontSize: 28,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  color: rank.color,
                  textShadow: `0 0 20px ${hexAlpha(rank.color, 0.5)}`,
                }}
              >
                {elo}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace">
                / {isTopTier ? "∞" : rank.eloMax}
              </Text>
            </Group>
          </Group>

          {/* Progress bar — uses Mantine Progress, custom colour via style */}
          <Progress
            value={progress}
            size="sm"
            radius="xl"
            style={{ "--progress-color": rank.color } as React.CSSProperties}
            styles={{
              root: {
                background: "var(--mantine-color-dark-5)",
              },
              section: {
                background: `linear-gradient(90deg, ${hexAlpha(rank.color, 0.6)}, ${rank.color})`,
                boxShadow: `0 0 8px ${hexAlpha(rank.color, 0.5)}`,
              },
            }}
          />

          {/* Range labels */}
          <Group justify="space-between">
            <Text size="xs" c="dimmed" ff="monospace">
              {rank.eloMin}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              {toNext !== null
                ? `${toNext} pts to next tier`
                : "MAX RANK"}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              {isTopTier ? "∞" : rank.eloMax}
            </Text>
          </Group>
        </Stack>
      </Box>
    </Stack>
  );
}