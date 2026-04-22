export type RankDefinition = {
  // Machine-stable ID — matches the `id` column in the Rank table (Will come later)
  id: string;
  // Display label shown on the badge 
  label: string;
  // Inclusive ELO bounds [min, max]. Use Number.MAX_SAFE_INTEGER for the top tier.
  eloMin: number;
  eloMax: number;
  // CSS hex colour used for border, glow, text
  color: string;
  // Single character / symbol rendered inside the badge
  icon: string;
  // Display order (ascending)
  order: number;
};

export const RANK_DEFINITIONS: RankDefinition[] = [
  {
    id: "null",
    label: "NULL",
    eloMin: 0,
    eloMax: 799,
    color: "#6b7280",
    icon: "∅",
    order: 0,
  },
  {
    id: "runtime",
    label: "RUNTIME",
    eloMin: 800,
    eloMax: 1199,
    color: "#cd7f32",
    icon: "▶",
    order: 1,
  },
  {
    id: "compile",
    label: "COMPILE",
    eloMin: 1200,
    eloMax: 1599,
    color: "#94a3b8",
    icon: "⚙",
    order: 2,
  },
  {
    id: "deploy",
    label: "DEPLOY",
    eloMin: 1600,
    eloMax: 1999,
    color: "#f59e0b",
    icon: "⬆",
    order: 3,
  },
  {
    id: "kernel",
    label: "KERNEL",
    eloMin: 2000,
    eloMax: 2399,
    color: "#10b981",
    icon: "◈",
    order: 4,
  },
  {
    id: "root",
    label: "ROOT",
    eloMin: 2400,
    eloMax: 2799,
    color: "#38bdf8",
    icon: "◆",
    order: 5,
  },
  {
    id: "sudo",
    label: "SUDO",
    eloMin: 2800,
    eloMax: Number.MAX_SAFE_INTEGER,
    color: "#a855f7",
    icon: "#",
    order: 6,
  },
];

// Returns the rank definition for a given ELO value. Falls back to NULL rank.
export function getRankForElo(elo: number): RankDefinition {
  return (
    RANK_DEFINITIONS.find((r) => elo >= r.eloMin && elo <= r.eloMax) ??
    RANK_DEFINITIONS[0]
  );
}

// Convenience: returns just the rank ID string for a given ELO.
export function getRankIdForElo(elo: number): string {
  return getRankForElo(elo).id;
}