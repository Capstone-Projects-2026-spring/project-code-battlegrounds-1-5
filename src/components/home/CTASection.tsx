import { Container, Title, Text, Button, Stack, Box } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { usePostHog } from "posthog-js/react";
import classes from "@/styles/comps/CTASection.module.css";

export default function CTASection() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();

  const handleCTA = () => {
    if (!session) {
      posthog?.capture("final_cta_clicked_not_authenticated");
      router.push("/login?redirect=/matchmaking");
      return;
    }
    posthog?.capture("final_cta_clicked");
    router.push("/matchmaking");
  };

  return (
    <Box 
      component="section" 
      py={100}
      className={classes.ctaSection}
    >
      <Container size="sm">
        <Stack gap="xl" align="center" ta="center">
          <Title order={2} className={classes.title}>
            Ready to Level Up Your Collaboration Skills?
          </Title>
          
          <Text size="lg" c="dimmed" maw={500}>
            Join developers learning pair programming through competitive gameplay.
          </Text>

          <Button
            size="xl"
            radius="md"
            leftSection={<IconPlayerPlay size={24} />}
            onClick={handleCTA}
            className={classes.ctaButton}
          >
            {session ? "Start Playing Now" : "Sign Up & Play"}
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
