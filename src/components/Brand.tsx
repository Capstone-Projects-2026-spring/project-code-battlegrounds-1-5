import { Group, Title, useComputedColorScheme, useMantineTheme, Text } from "@mantine/core";
import Link from "next/link";

import { Sixtyfour } from "next/font/google";

const sixtyfour = Sixtyfour({
  subsets: ["latin"],
  display: "swap"
});

export interface BrandProps {
  blink?: boolean;
}
export default function Brand(props: BrandProps) {
  const colorScheme = useComputedColorScheme();
  const theme = useMantineTheme();
  const primary = colorScheme === "light"
    ? theme.colors.console[4]
    : theme.colors.console[3];

  return (
    <Group
      gap="lg"
      component={Link}
      // @ts-expect-error // incorrect typing
      href="/"
    >
      <Title
        order={2}
        c={primary}
        ff={sixtyfour.style.fontFamily}
        fw={"normal"}
      >
        <span>
          &gt;
        </span>
        <span
          className={props.blink ? "blinky" : undefined}
          style={{ marginRight: "1rem" }}
        >
          _
        </span>

        <span style={{ fontStyle: "italic" }}>
          CODE_BATTLEGROUNDS
        </span>
      </Title>
    </Group>
  );
}