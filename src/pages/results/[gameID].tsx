import { useEffect, useState } from "react";
import Head from "next/head";
import { Stack, Box, Title, Flex } from "@mantine/core";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import TestCaseResultsBox from "@/components/TestCaseResultsBox";
import AnalysisBox from "@/components/Analysisbox";
import ProblemBox from "@/components/ProblemBox";
import type { ActiveProblem } from '@/components/ProblemBox';
import { io, Socket } from 'socket.io-client';
import { IconEye, IconPlayerPlay, IconPlayerTrackNextFilled, IconPlus } from '@tabler/icons-react';
import GameTestCase from '@/components/gameTests/GameTestCase';
import { GameType } from "@prisma/client";
import { GameTestCasesProvider, TestableCase, useTestCases } from "@/components/gameTests/GameTestCasesContext";


interface RoomDetailsResponse {
  problem: ActiveProblem;
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
  const [socket, setSocket] = useState<Socket | null>(null);

  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<ActiveProblem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [gameType, setGameType] = useState<GameType | null>(null);
  
  useEffect(() => {
    const loadProblem = async () => {
      try {
        const response = await fetch(`/api/rooms/${gameId}`);
        if (!response.ok) return;
        const data = (await response.json()) as RoomDetailsResponse;
        setProblem(data.problem);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load room problem', error);
      }
    };
    loadProblem();
  }, [gameId, session?.user.id]);

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
