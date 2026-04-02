
import { useEffect, useState, useRef } from "react";
import Head from "next/head";
import { Stack, Box, Title, Flex, ActionIcon, Tooltip } from "@mantine/core";
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
  const socketRef = useRef<Socket | null>(null);
  const [problem, setProblem] = useState<ActiveProblem | null>(null);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [isProblemVisible, setIsProblemVisible] = useState(true);
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev);
  
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

  useEffect(() => {
    if (!session?.user.id || !gameId || socketRef.current) return;

    const fetchGameType = async () => {
      const res = await fetch(`/api/rooms/type?gameId=${gameId}`);
      const data = await res.json();
      if (data.gameType) {
        setGameType(data.gameType);
      }
    };
    fetchGameType();
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
              <AnalysisBox />
              <TestCaseResultsBox />
            </Stack>

          </Flex>
        </Box>
      </Stack>
    </>
  );
}
