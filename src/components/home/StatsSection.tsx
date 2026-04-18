import { Container, Group, Stack, Text, Box } from "@mantine/core";
import { IconUsers, IconDeviceGamepad2, IconClock } from "@tabler/icons-react";
import classes from "@/styles/comps/StatsSection.module.css";

interface Stat {
  value: string;
  label: string;
  icon: React.ReactNode;
}

const stats: Stat[] = [
  {
    value: "1,000+",
    label: "Active Developers",
    icon: <IconUsers size={28} />,
  },
  {
    value: "10,000+",
    label: "Matches Played",
    icon: <IconDeviceGamepad2 size={28} />,
  },
  {
    value: "50,000+",
    label: "Hours Practiced",
    icon: <IconClock size={28} />,
  },
];

export default function StatsSection() {
  return (
    <Box 
      component="section" 
      py={60}
      className={classes.statsSection}
      aria-label="Platform statistics"
    >
      <Container size="lg">
        <Group justify="center" gap="xl">
          {stats.map((stat, index) => (
            <Stack 
              key={index} 
              gap="xs" 
              align="center"
              className={classes.statCard}
            >
              <Box className={classes.iconWrapper}>
                {stat.icon}
              </Box>
              <Text 
                size="xl" 
                fw={700}
                className={classes.statValue}
              >
                {stat.value}
              </Text>
              <Text 
                size="sm" 
                c="dimmed"
                ta="center"
              >
                {stat.label}
              </Text>
            </Stack>
          ))}
        </Group>
      </Container>
    </Box>
  );
}
