import { useState, useEffect } from "react";
import Head from "next/head";
import { Stack, Box, Title, Flex } from "@mantine/core";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import TestCaseResultsBox from "@/components/TestCaseResultsBox";
import AnalysisBox from "@/components/Analysisbox";
import ProblemBox from "@/components/ProblemBox";
import { usePostHog } from "posthog-js/react";


export default function Results() {
  const router = useRouter();
  const { gameID } = router.query;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();

  useEffect(() => {
    posthog.capture("results_viewed");
  }, [posthog]);

  if (!session) return null;

  return (
    <>
      <Head>
        <title>Results | Code BattleGrounds</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Stack h="100vh" gap={0}>
        <Navbar
          links={["Time", "Players", "Tournament"]}
          title="Code BattleGrounds"
        />

        <Box p="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          <Title order={2} mb="md" ta="center">
            Match Results
          </Title>

          <Flex gap="md" align="stretch" style={{ flex: 1 }}>

            <Box style={{ flex: 1 }}>
              <ProblemBox />
            </Box>

            <Stack style={{ flex: 2 }} gap="md">
              <AnalysisBox />
              <TestCaseResultsBox />
            </Stack>

          </Flex>
        </Box>
      </Stack>
    </>
  );
}
