import { Container, Title, Text, SimpleGrid, Box, ThemeIcon, Stack } from "@mantine/core";
import { IconCode, IconTestPipe, IconTrophy, IconRefresh } from "@tabler/icons-react";
import classes from "@/styles/comps/HowItWorksSection.module.css";

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const steps: Step[] = [
  {
    icon: <IconCode size={32} />,
    title: "Match & Select Role",
    description: "Get paired with a teammate. One codes the solution, the other writes test cases to validate it.",
    color: "console",
  },
  {
    icon: <IconTestPipe size={32} />,
    title: "Collaborate in Real-Time",
    description: "Work together through live code synchronization and chat. Testers validate, coders implement.",
    color: "console",
  },
  {
    icon: <IconRefresh size={32} />,
    title: "Swap Roles Mid-Game",
    description: "Automatically switch roles during the match. Experience both perspectives of pair programming.",
    color: "console",
  },
  {
    icon: <IconTrophy size={32} />,
    title: "Win Through Quality",
    description: "Score based on code efficiency, correctness, and collaboration. Speed matters, but quality wins.",
    color: "console",
  },
];

export default function HowItWorksSection() {
  return (
    <Box 
      component="section" 
      py={80}
      id="how-it-works"
      aria-labelledby="how-it-works-title"
    >
      <Container size="lg">
        <Stack gap="xl" align="center" mb={60}>
          <Title 
            id="how-it-works-title"
            order={2} 
            ta="center" 
            className={classes.sectionTitle}
          >
            How It Works
          </Title>
          <Text size="lg" c="dimmed" ta="center" maw={600}>
            Learn the fundamentals of pair programming through structured, competitive gameplay
          </Text>
        </Stack>

        <SimpleGrid 
          cols={{ base: 1, sm: 2, md: 4 }} 
          spacing="xl"
        >
          {steps.map((step, index) => (
            <Box 
              key={index}
              className={classes.stepCard}
            >
              <ThemeIcon
                size={70}
                radius="md"
                variant="light"
                color={step.color}
                mb="md"
              >
                {step.icon}
              </ThemeIcon>
              
              <Text 
                fw={700} 
                size="lg" 
                mb="xs"
                className={classes.stepTitle}
              >
                {step.title}
              </Text>
              
              <Text size="sm" c="dimmed">
                {step.description}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}
