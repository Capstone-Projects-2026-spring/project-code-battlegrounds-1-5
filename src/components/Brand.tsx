import { Group, Title, useComputedColorScheme, useMantineTheme } from "@mantine/core";
import { IconPrompt } from "@tabler/icons-react";
import Link from "next/link";

export default function Brand() {
  const colorScheme = useComputedColorScheme();
  const theme = useMantineTheme();
  const primary = colorScheme === "light"
    ? theme.colors.console[4]
    : theme.colors.console[3];
  const iconSize = theme.headings.sizes.h1.fontSize;

  return (
    <Group
      gap="xs"
      align="center"
      component={Link}
      // @ts-expect-error // incorrect typing
      href="/"
    >
      <IconPrompt color={primary} size={iconSize} />
      <Title order={2} c={primary} fs={"italic"}>
        CODE_BATTLEGROUNDS
      </Title>
    </Group>
  );
}