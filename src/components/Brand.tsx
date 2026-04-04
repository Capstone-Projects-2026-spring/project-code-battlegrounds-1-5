import { Group, Title, useComputedColorScheme, useMantineTheme, Text } from "@mantine/core";
import Link from "next/link";

import { Sixtyfour } from "next/font/google";

const sixtyfour = Sixtyfour({
  subsets: ["latin"],
  display: "swap"
});

export default function Brand() {
  const colorScheme = useComputedColorScheme();
  const theme = useMantineTheme();
  const primary = colorScheme === "light"
    ? theme.colors.console[4]
    : theme.colors.console[3];
  const iconSize = theme.headings.sizes.h1.fontSize;

  return (
    <Group
      gap="lg"
      component={Link}
      // @ts-expect-error // incorrect typing
      href="/"
    >
      <Group gap={0}>
        <Text
          c={primary}
          size={iconSize}
        >
          &gt;
        </Text>
        <Text
          c={primary}
          size={iconSize}
          className="blinky"
        >
          _
        </Text>
      </Group>
      <Title
        order={2}
        c={primary}
        fs={"italic"}
        ff={sixtyfour.style.fontFamily}
        fw={"normal"}
      >
        CODE_BATTLEGROUNDS
      </Title>
    </Group>
  );
}