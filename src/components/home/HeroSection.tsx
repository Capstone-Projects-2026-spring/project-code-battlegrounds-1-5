import { Container, Title, Text, Button, Group, Box, Stack } from "@mantine/core";
import { IconPlayerPlay, IconUsers } from "@tabler/icons-react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { usePostHog } from "posthog-js/react";
import classes from "./HeroSection.module.css";

export default function HeroSection() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();

  const handleQuickMatch = () => {
    if (!session) {
      posthog?.capture("hero_cta_clicked_not_authenticated");
      router.push("/login?redirect=/matchmaking");
      return;
    }
    posthog?.capture("hero_quick_match_clicked");
    router.push("/matchmaking");
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
          <Title 
            className={classes.title}
            component="h1"
          >
            Master Pair Programming
            <br />
            <Text 
              component="span" 
              variant="gradient"
              gradient={{ from: "blue", to: "cyan", deg: 45 }}
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
              size="xl"
              radius="md"
              leftSection={<IconPlayerPlay size={24} />}
              onClick={handleQuickMatch}
              className={classes.primaryButton}
              data-testid="hero-quick-match"
            >
              Quick Match
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
