import { Stack, Text } from "@mantine/core";
import type { RankDefinition } from "@/lib/ranks";

export type RankBadgeSize = "xs" | "sm" | "md" | "lg";

type SizeTokens = {
  outer: number;
  icon: number;
  label: number;
  sub: number;
  gap: number;
  borderWidth: number;
};

const SIZE_MAP: Record<RankBadgeSize, SizeTokens> = {
  xs: { outer: 36,  icon: 13, label: 8,  sub: 6,  gap: 2, borderWidth: 1.5 },
  sm: { outer: 52,  icon: 18, label: 10, sub: 7,  gap: 4, borderWidth: 1.5 },
  md: { outer: 68,  icon: 23, label: 12, sub: 9,  gap: 5, borderWidth: 2   },
  lg: { outer: 92,  icon: 31, label: 16, sub: 11, gap: 7, borderWidth: 2.5 },
};

/** Converts a hex colour + alpha (0-1) to rgba() */
function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type RankBadgeProps = {
  rank: RankDefinition;
  size?: RankBadgeSize;
  /** When true the badge renders in its highlighted / filled state */
  active?: boolean;
};

export function RankBadge({ rank, size = "md", active = false }: RankBadgeProps) {
  const s = SIZE_MAP[size];
  const glow = hexAlpha(rank.color, 0.45);
  const bgDim = hexAlpha(rank.color, 0.08);
  const bgActive = hexAlpha(rank.color, 0.22);
  const borderDim = hexAlpha(rank.color, 0.35);

  return (
    <Stack gap={s.gap} align="center" style={{ userSelect: "none" }}>
      {/* Badge tile */}
      <div
        style={{
          width: s.outer,
          height: s.outer,
          borderRadius: "16%",
          border: `${s.borderWidth}px solid ${active ? rank.color : borderDim}`,
          background: active
            ? `radial-gradient(circle at 38% 38%, ${bgActive}, ${bgDim})`
            : bgDim,
          boxShadow: active
            ? `0 0 ${s.outer * 0.55}px ${glow}, inset 0 0 ${s.outer * 0.3}px ${glow}`
            : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          transition: "box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease",
          transform: active ? "scale(1.08)" : "scale(1)",
        }}
      >
        {/* Inner accent ring */}
        <div
          style={{
            position: "absolute",
            inset: 3,
            borderRadius: "12%",
            border: `1px solid ${active ? hexAlpha(rank.color, 0.3) : "transparent"}`,
            pointerEvents: "none",
            transition: "border-color 0.2s ease",
          }}
        />
        <span
          style={{
            fontSize: s.icon,
            color: active ? rank.color : hexAlpha(rank.color, 0.5),
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            lineHeight: 1,
            transition: "color 0.2s ease",
          }}
        >
          {rank.icon}
        </span>
      </div>

      {/* Labels — Mantine Text */}
      <Stack gap={1} align="center">
        <Text
          size={`${s.label}px`}
          fw={700}
          ff="monospace"
          style={{
            letterSpacing: "0.07em",
            color: active ? rank.color : hexAlpha(rank.color, 0.5),
            transition: "color 0.2s ease",
            lineHeight: 1.2,
          }}
        >
          {rank.label}
        </Text>
        <Text
          size={`${s.sub}px`}
          ff="monospace"
          style={{
            letterSpacing: "0.04em",
            color: active ? hexAlpha(rank.color, 0.7) : "var(--mantine-color-dark-3)",
            transition: "color 0.2s ease",
            lineHeight: 1.2,
          }}
        >
          {rank.sublabel}
        </Text>
      </Stack>
    </Stack>
  );
}