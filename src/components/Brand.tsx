import { Group, Title, useComputedColorScheme, useMantineTheme } from "@mantine/core";
import Link from "next/link";

import { Sixtyfour } from "next/font/google";
import classes from '../styles/comps/Brand.module.css';

const sixtyfour = Sixtyfour({
  subsets: ["latin"],
  display: "swap"
});

export interface BrandProps {
  blink?: boolean;
  link?: string;
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
      className={classes.brand}
    >
      <Title
        order={2}
        c={primary}
        ff={sixtyfour.style.fontFamily}
        fw={"normal"}
        {...props.link ? {
          component: Link,
          href: props.link,
          style: { cursor: "pointer" }
        } : { style: { cursor: "default" } }}
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