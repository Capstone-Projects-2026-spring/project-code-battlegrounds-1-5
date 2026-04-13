import { Container, Title, Text, Button, Group, Box, Stack } from "@mantine/core";
import { IconPlayerPlay, IconUsers } from "@tabler/icons-react";
import { usePostHog } from "posthog-js/react";
import classes from "@/styles/comps/HeroSection.module.css";
import Brand from "../Brand";
import Link from "next/link";

export default function HeroSection() {
  const posthog = usePostHog();

  const handlePlayNow = () => {
    posthog?.capture("hero_quick_match_clicked");
    // router.push("/matchmaking");
  };

  const handleLearnMore = () => {
    posthog?.capture("hero_learn_more_clicked");
    document.getElementById("how-it-works")?.scrollIntoView({ 
      behavior: "smooth",
      block: "start"
    });
  };

  return (
    <Box className={classes.hero} component="section" aria-label="Hero section">
      <Container size="lg" className={classes.heroInner}>
        <Stack gap="xl" align="center" ta="center">
          {/* Main Headline */}
          <Brand blink />
          <Title 
            className={classes.title}
            component="h1"
          >
            Master Pair Programming
            <br />
            <Text 
              component="span" 
              variant="gradient"
              gradient={{ from: "console.4", to: "console.2", deg: 45 }}
              inherit
            >
              Through Competition
            </Text>
          </Title>

          {/* Subheadline */}
          <Text size="xl" maw={600} c="dimmed" className={classes.description}>
            Real-time coding battles where one teammate codes, the other tests. 
            Build better software together through competitive collaboration.
          </Text>

          {/* Primary CTAs */}
          <Group gap="md" mt="xl">
            <Button
              component={Link}
              href="/matchmaking"
              size="xl"
              radius="md"
              leftSection={<IconPlayerPlay size={24} />}
              onClick={handlePlayNow}
              className={classes.primaryButton}
              data-testid="hero-quick-match"
            >
              Play Now
            </Button>
            
            <Button
              size="xl"
              radius="md"
              variant="outline"
              leftSection={<IconUsers size={24} />}
              onClick={handleLearnMore}
              className={classes.secondaryButton}
            >
              How It Works
            </Button>
          </Group>
        </Stack>
      </Container>

      {/* Animated background gradient */}
      <div className={classes.gradient} aria-hidden="true" />
    </Box>
  );
}
