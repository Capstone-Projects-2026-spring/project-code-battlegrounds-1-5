import { useEffect, useState } from "react";
import Head from "next/head";
import { Stack, Box, Title, Flex, ActionIcon, Tooltip } from "@mantine/core";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import TestCaseResultsBox from "@/components/TestCaseResultsBox";
import AnalysisBox, { AnalysisBoxProps } from "@/components/Analysisbox";
import ProblemBox from "@/components/ProblemBox";
import { usePostHog } from "posthog-js/react";
import type { ActiveProblem } from '@/components/ProblemBox';
import { IconEye } from '@tabler/icons-react';


interface RoomDetailsResponse {
  problem: ActiveProblem;
}

interface ResultCodeResponse {
  team1Code: string | null;
  team2Code: string | null;
}

export default function Page() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  // Early auth check to prevent loading all the heavy stuff
  // if we aren't even logged in
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth");
    }
  }, [isPending, session, router]);
  return <Results />;
}

export function Results() {
  //grab id from url
  const router = useRouter();
  const gameId = router.query.gameID as string;
  const { data: session } = authClient.useSession();
  const [problem, setProblem] = useState<ActiveProblem | null>(null);
  const posthog = usePostHog();

  useEffect(() => {
    posthog.capture("results_viewed");
  }, [posthog]);

  const [isProblemVisible, setIsProblemVisible] = useState(true);
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev);
  const [analysisProps, setAnalysisProps] = useState<AnalysisBoxProps | null>(null);
  const [gameType, setGameType] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id || !gameId) return;

    const loadProblem = async () => {
      try {
        const response = await fetch(`/api/rooms/${gameId}`);
        if (!response.ok) return;
        const data = (await response.json()) as RoomDetailsResponse;
        setProblem(data.problem);
      } catch (error) {
        console.error('Failed to load room problem', error);
      }
    };

    const retrieveCode = async () => {
      try {
        const response = await fetch(`/api/rooms/result?gameId=${gameId}`);
        if (!response.ok) return;
        const data = (await response.json()) as ResultCodeResponse;

        if (data.team1Code) {
          setAnalysisProps({
            team1Code: data.team1Code,
            team2Code: data.team2Code ?? undefined,
            gameType: gameType as "TWOPLAYER" | "FOURPLAYER",
          });
        }
      } catch (error) {
        console.error('Failed to load result code', error);
      }
    };

    const loadGameType = async () => {
      try {
        const response = await fetch(`/api/rooms/type?gameId=${gameId}`);
        if (!response.ok) return;
        const data = (await response.json()) as { gameType: string };
        setGameType(data.gameType);
      } catch (error) {
        console.error('Failed to load game type', error);
      }
    };

    const loadData = async () => {
      await Promise.all([loadProblem(), retrieveCode(), loadGameType()]);
    };

    loadData();
  }, [gameId, session?.user.id]);

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

            <Box
              style={{
                width: isProblemVisible ? "25%" : "50px",
                minWidth: isProblemVisible ? "250px" : "50px",
                color: "white",
                backgroundColor: "#333",
                padding: "0",
                overflowY: "auto",
                display: "flex",
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: isProblemVisible ? 'flex-start' : 'center',
                flexShrink: 0,
                transition: 'width 0.2s ease, min-width 0.2s ease',
                borderRadius: '8px',
              }}
            >
              {isProblemVisible ? (
                <Box style={{ width: '100%', flex: 1, minHeight: 0, padding: '1rem' }}>
                  <ProblemBox problem={problem} onToggleVisibility={toggleProblemVisibility} />
                </Box>
              ) : (
                <Tooltip label="Show Problem">
                  <ActionIcon variant="transparent" color="gray" size="xl" onClick={toggleProblemVisibility} title="Show Problem">
                    <IconEye size={24} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Box>

            <Stack style={{ flex: 2 }} gap="md">
              <AnalysisBox {...analysisProps ?? { team1Code: "", gameType: gameType as "TWOPLAYER" | "FOURPLAYER" }} />
              <TestCaseResultsBox gameId={gameId} showOtherTeamColumn={gameType === "FOURPLAYER"} gameType={gameType} />
            </Stack>

          </Flex>
        </Box>
      </Stack>
    </>
  );
}
