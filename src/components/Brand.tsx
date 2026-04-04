import { Group, Title, useMantineTheme } from "@mantine/core";
import { IconPrompt } from "@tabler/icons-react";
import Link from "next/link";

export default function Brand() {
  const theme = useMantineTheme();
  const primary = theme.colors.console[4];
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