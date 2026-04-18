import { ActionIcon, Box, Button, Center, Group, Loader, Modal, Select, Stack, Tabs, Text, Tooltip } from '@mantine/core';
import { Editor } from '@monaco-editor/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { IconEye, IconPlayerPlay, IconPlayerTrackNextFilled, IconPlus } from '@tabler/icons-react';
import { usePostHog } from 'posthog-js/react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

import ChatBox from '@/components/ChatBox';
import GameTimer from '@/components/GameTimer';
import TeamSelect from "@/components/TeamSelect";
import { TeamCount } from "@/components/TeamSelect";
import type { ActiveProblem } from "@/components/ProblemBox";
import ProblemBox from "@/components/ProblemBox";
import RoleFlipPopup from "@/components/RoleFlipPopup";
import { showRoleSwapWarning } from "@/components/notifications";

import { Role, GameStatus, GameType } from "@prisma/client";
import { authClient } from "@/lib/auth-client";
import GameTestCase from "@/components/gameTests/GameTestCase";
import {
  GameTestCasesProvider,
  TestableCase,
  useTestCases,
} from "@/contexts/GameTestCasesContext";
import { ParameterType } from "@/lib/ProblemInputOutput";
import NewParameterButton from "@/components/gameTests/NewParameterButton";
import {
  GameStateProvider,
  useGameState,
} from "@/contexts/GameStateContext";
import { useSocket } from '@/contexts/SocketContext';
import { useMatchmaking } from '@/contexts/MatchmakingContext';

import styles from "@/styles/GameRoom.module.css";
import { convertSegmentPathToStaticExportFilename } from 'next/dist/shared/lib/segment-cache/segment-value-encoding';
import { ReactServerDOMTurbopackServer } from 'next/dist/server/route-modules/app-page/vendored/rsc/entrypoints';

interface RoomDetailsResponse {
  problem: ActiveProblem;
  gameType: GameType;
  status: GameStatus;
  teams: TeamCount[];
  teamId: string | null;
  role: Role | null;
}

// interface TestCase {
//   id: string
//   content: string
// }

export default function Page() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  // Early auth check to prevent loading all the heavy stuff
  // if we aren't even logged in
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return <EnteringBattleground />;
  }

  return (
    <GameStateProvider>
      <GameTestCasesProvider>
        <PlayGameRoom />
      </GameTestCasesProvider>
    </GameStateProvider>
  );
}

function PlayGameRoom() {
  // 1. Grab the ID from the URL (e.g., "624")
  const router = useRouter();
  const gameId = router.query.gameID as string;
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();

  // 2. Set up our game state and the user's role
  const [role, setRole] = useState<Role | null>(null);
  const [gameState, setGameState] = useState<GameStatus>(GameStatus.WAITING);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<ActiveProblem | null>(null);
  const [teams, setTeams] = useState<TeamCount[]>([]);
  const [teamSelected, setTeamSelected] = useState<string | null>(null);
  const [liveCode, setLiveCode] = useState<string>("function solution(a, b) { \n\treturn a + b;\n}");
  const [activeTestId, setActiveTestId] = useState<number>(0);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [isWaitingForOtherTeam, setIsWaitingForOtherTeam] = useState(false);

  const [runningAllTests, setRunningAllTests] = useState<boolean>(false);

  // Context <3
  const testCaseCtx = useTestCases();
  const gameStateCtx = useGameState();
  const { socket } = useSocket();
  const { setStatus } = useMatchmaking();

  const [spectatorView, setSpectatorView] = useState<Role>(Role.SPECTATOR);

  const endTimeRef = useRef<number | null>(null);
  const [endTime, setEndTime] = useState(0);
  const [isProblemVisible, setIsProblemVisible] = useState(true);
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev);
  const [editorFocused, setEditorFocused] = useState(false);

  const isSpectator = role === Role.SPECTATOR;
  const selectedTestId = testCaseCtx.cases.some(
    (testCase) => testCase.id === activeTestId,
  )
    ? activeTestId
    : (testCaseCtx.cases[0]?.id ?? 0);

  const handleTimerExpire = useCallback(() => {
    if (!socket || !gameType || !teamSelected) return;
    const teamIndex = teams.findIndex((entry) => entry.teamId === teamSelected);
    const team = teamIndex === 0 ? "team1" : teamIndex === 1 ? "team2" : null;
    setIsWaitingForOtherTeam(true);

    const codeToSubmit = gameStateCtx.code || liveCode || "";

    console.log("Timer expired - submitting code:", {
      liveCode,
      gameStateCtxCode: gameStateCtx.code,
      codeToSubmit,
      teamSelected,
      gameId,
    });

    socket.emit("submitCode", {
      roomId: gameId,
      code: codeToSubmit,
      type: gameType,
      team,
      teamId: teamSelected,
    });
  }, [socket, gameType, teamSelected, gameId, gameStateCtx, liveCode, teams]);

  useEffect(() => {
    if (router.query.teamId && router.query.role) {
      setTeamSelected(router.query.teamId as string);
      setRole(router.query.role as Role);
    }
  }, [router.query.teamId, router.query.role]);

  // ONLY HAPPENS ON PAGE LAUNCH
  useEffect(() => {
    if (!session?.user.id || !gameId || !socket) return;

    gameStateCtx.setGameId(gameId);

    const loadRoomDetails = async () => {
      try {
        const response = await fetch(`/api/rooms/${gameId}/${session.user.id}`);
        if (!response.ok) {
          // Game room doesn't exist or user isn't authorized — send them home
          router.replace("/");
          return;
        }
        const data = (await response.json()) as RoomDetailsResponse;

        // If the game is already finished, send straight to results
        if (data.status === GameStatus.FINISHED) {
          router.replace(`/results/${gameId}`);
          return;
        }

        setProblem(data.problem as ActiveProblem);
        setGameType(data.gameType as GameType);
        setTeams(data.teams as TeamCount[]);
        if (data.teamId) setTeamSelected(data.teamId as string);
        if (data.role) setRole(data.role as Role);
        console.log("Fetched room details:", data);

        if (
          data.gameType === GameType.TWOPLAYER &&
          !data.teamId &&
          !data.role
        ) {
          // Auto-join team if it's a 2 player game and the user isn't assigned to a team yet
          const teamId = data.teams[0]?.teamId;
          if (teamId) {
            const res = await fetch(`/api/team/join`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: session.user.id,
                teamId,
                gameRoomId: gameId,
              }),
            });
            if (res.ok) {
              const joined = await res.json();
              setTeamSelected(teamId);
              setRole(joined.role);
            }
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Failed to load room problem", error);
        router.replace("/");
      }
    };
    loadRoomDetails();

    // 3. Initialize the connection to our custom server.js backend

    const teamUpdatedHandler = ({ teamId, playerCount }: { teamId: string; playerCount: number }) => {
      setTeams((prev) => prev.map((t) => (t.teamId === teamId ? { ...t, playerCount } : t)));
    };

    const invalidGameHandler = () => {
      router.replace('/');
    }

    const errorHandler = (data: JSON) => {
      console.error("Socket error:", data);
    };

    // This is so if another person picks while someone is deciding
    socket.on("teamUpdated", teamUpdatedHandler);

    socket.on('invalidGame', invalidGameHandler);
    socket.on("error", errorHandler);

    // 6. Cleanup: disconnect the socket if the user leaves the page
    return () => {
      socket.off("teamUpdated", teamUpdatedHandler);
      socket.off('invalidGame', invalidGameHandler);
      socket.off("error", errorHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, session?.user.id]);

  useEffect(() => {
    // Runs after team gets selected - join rooms first, then set up room-specific listeners
    if (!socket || !teamSelected || !gameId || !gameType) return;
    socket.emit("joinGame", { gameId, teamId: teamSelected, gameType });
    gameStateCtx.setGameType(gameType);

    // Set up game room event listeners AFTER joining the room
    const handleGameStarting = () => {
      posthog.capture("game_spectated", { gameId });
      setGameState(GameStatus.STARTING);
    };

    const handleGameStarted = ({ start }: { start: number }) => {
      if (isNaN(start)) return;
      posthog.capture("game_started", { gameId });
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + Number(start);
        setEndTime(endTimeRef.current);
      }
      setGameState(GameStatus.ACTIVE);
    };

    const handleGameEnded = () => {
      posthog.capture("game_ended", { gameId });
      setIsWaitingForOtherTeam(false);
      setGameState(GameStatus.FINISHED);
      setStatus("idle"); // reset matchmaking status so players can queue again from results page
      router.push(`/results/${gameId}`);
    };

    const handleRoleSwapWarning = () => {
      if (role) {
        showRoleSwapWarning(role);
      } else {
        showRoleSwapWarning(Role.SPECTATOR);
      }
    };

    const handleRoleSwapping = () => {
      setGameState(GameStatus.FLIPPING);
    };

    const handleRoleSwap = () => {
      setGameState(GameStatus.ACTIVE);
      setRole((prev) =>
        prev === Role.SPECTATOR
          ? Role.SPECTATOR
          : prev === Role.CODER
            ? Role.TESTER
            : Role.CODER,
      );
    };

    const handleWaitingForOtherTeam = () => {
      setIsWaitingForOtherTeam(true);
    };

    socket.on("gameStarting", handleGameStarting);
    socket.on("gameStarted", handleGameStarted);
    socket.on("gameEnded", handleGameEnded);
    socket.on("roleSwapWarning", handleRoleSwapWarning);
    socket.on("roleSwapping", handleRoleSwapping);
    socket.on("roleSwap", handleRoleSwap);
    socket.on("waitingForOtherTeam", handleWaitingForOtherTeam);

    return () => {
      socket.off("gameStarting", handleGameStarting);
      socket.off("gameStarted", handleGameStarted);
      socket.off("gameEnded", handleGameEnded);
      socket.off("roleSwapWarning", handleRoleSwapWarning);
      socket.off("roleSwapping", handleRoleSwapping);
      socket.off("roleSwap", handleRoleSwap);
      socket.off("waitingForOtherTeam", handleWaitingForOtherTeam);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, teamSelected, gameId, gameType, role]);

  useEffect(() => {
    if (!socket || !teamSelected) return;

    const testHandler = (cases: TestableCase[] | null) => {
      console.log("Receiving test case sync!", cases);
      if (Array.isArray(cases)) {
        testCaseCtx.setCases(cases);
        setActiveTestId((prevActiveTestId) =>
          cases.some((testCase) => testCase.id === prevActiveTestId)
            ? prevActiveTestId
            : (cases[0]?.id ?? 0),
        );
      } else {
        console.warn("Ignoring invalid test case payload from server:", cases);
      }
      setRunningAllTests(false);
    };

    const codeHandler = (newCode: string) => {
      setLiveCode(newCode);
      // must also set code in game state otherwise coder cant run their test cases
      gameStateCtx.setCode(newCode);
    };

    socket.on("receiveTestCaseSync", testHandler);
    socket.on("receiveCodeUpdate", codeHandler);

    socket.emit("requestCodeSync", { teamId: teamSelected });
    socket.emit("requestTestCaseSync", { teamId: teamSelected });

    return () => {
      socket.off("receiveTestCaseSync", testHandler);
      socket.off("receiveCodeUpdate", codeHandler);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, teamSelected]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && role === Role.CODER && socket) {
      setLiveCode(value);
      socket.emit("codeChange", { teamId: teamSelected, code: value });
      gameStateCtx.setCode(value);
    }
  };
  const getTeamLabel = () => {
    if (!teamSelected) return null;
    const teamIndex = teams.findIndex((team) => team.teamId === teamSelected);
    if (teamIndex === 0) return "team1";
    if (teamIndex === 1) return "team2";
    return null;
  };

  const submitFinalCode = () => {
    //Send bother Coder and Tester to the results page
    //Store submission and evaluate results on the backend
    //server broadcasts the event to both player
    if (!socket || !gameType || !teamSelected) return; //make sure the socket is connected before emitting
    const team = getTeamLabel();
    setIsWaitingForOtherTeam(true);
    const codeToSubmit = gameStateCtx.code || liveCode || "";

    socket.emit("submitCode", {
      roomId: gameId,
      code: codeToSubmit,
      type: gameType,
      team,
      teamId: teamSelected,
    });
  };

  const addNewTest = () => {
    if (testCaseCtx.cases.length >= 5) return;

    // const newId = testCaseCtx.cases.length; // zero-based index
    const newId =
      testCaseCtx.cases
        .map((c) => c.id)
        .reduce((prev, acc) => Math.max(prev, acc)) + 1;
    console.log("creating new test with id", newId);
    const newCase: TestableCase = {
      id: newId,
      functionInput: testCaseCtx.parameters
        .filter((p) => !p.isOutputParameter)
        .map((c) => ({
          ...c,
          value: null,
        })),
      expectedOutput: {
        ...testCaseCtx.parameters.find((p) => p.isOutputParameter)!,
        value: null,
      },
    };
    testCaseCtx.addCase(newCase);

    setActiveTestId(newId);
    console.log("emitting new test cases", [...testCaseCtx.cases, newCase]);
    socket?.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: [...testCaseCtx.cases, newCase],
    });
  };

  const removeTest = (testId: TestableCase["id"]) => {
    if (testCaseCtx.cases.length === 1 || isWaitingForOtherTeam) return;

    const newId = testCaseCtx.cases
      .map((c) => c.id)
      .reduce((prev, acc) => Math.min(prev, acc));
    console.log(`removing test with id ${testId}`, `min id ${newId}`);
    testCaseCtx.removeCase(testId);

    setActiveTestId(newId);
    console.log("emitting new test cases", [
      ...testCaseCtx.cases.filter((c) => c.id !== testId),
    ]);
    socket?.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: [...testCaseCtx.cases.filter((c) => c.id !== testId)],
    });
  };

  const handleNewParameter = (parameter: ParameterType) => {
    if (isWaitingForOtherTeam) return;

    const cases = testCaseCtx.cases;
    const newCases = cases.map((c) => ({
      ...c,
      functionInput: [...c.functionInput, parameter],
    }));
    console.log("emitting new test cases", newCases);
    testCaseCtx.setParameters((prev) => [...prev, parameter]);
    testCaseCtx.setCases(newCases);
    socket?.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: newCases,
    });

    posthog.capture("parameter_created", {
      gameId: gameStateCtx.gameId,
      parameter,
    });
  };

  const handleParameterDelete = (parameter: ParameterType) => {
    if (isWaitingForOtherTeam) return;

    const cases = testCaseCtx.cases;
    const newCases = cases.map((c) => ({
      ...c,
      functionInput: c.functionInput.filter((i) => i.name !== parameter.name),
    }));
    console.log("emitting new test cases", newCases);
    testCaseCtx.setParameters((prev) =>
      prev.filter((p) => p.name !== parameter.name),
    );
    testCaseCtx.setCases(newCases);
    socket?.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: newCases,
    });
  };

  const handleTestBoxChange = (testCase: TestableCase) => {
    if (role !== Role.TESTER || !socket || isWaitingForOtherTeam) return;
    const updated = testCaseCtx.cases.map((t) =>
      t.id === selectedTestId ? testCase : t,
    );
    testCaseCtx.setCases(updated);
    socket.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: updated,
    });
  };

  const handleExpectedOutputTypeChange = (type: ParameterType["type"]) => {
    if (
      role !== Role.TESTER ||
      !socket ||
      !teamSelected ||
      isWaitingForOtherTeam
    ) {
      return;
    }

    const currentOutputType = testCaseCtx.parameters.find(
      (parameter) => parameter.isOutputParameter,
    )?.type;
    if (currentOutputType === type) return;

    testCaseCtx.setParameters((prev) =>
      prev.map((parameter) =>
        parameter.isOutputParameter
          ? {
              ...parameter,
              type,
              value: null,
            }
          : parameter,
      ),
    );

    const updatedCases = testCaseCtx.cases.map((testCase) => ({
      ...testCase,
      expectedOutput: {
        ...testCase.expectedOutput,
        type,
        value: null,
      },
      computedOutput: null,
    }));

    testCaseCtx.setCases(updatedCases);
    socket.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: updatedCases,
    });
  };

  const handleRunAllTests = () => {
    if (role !== Role.TESTER || !socket || isWaitingForOtherTeam) return;

    setRunningAllTests(true);
    socket.emit("submitTestCases", {
      code: liveCode,
      testCases: testCaseCtx.cases,
      runIDs: testCaseCtx.cases.map((t) => t.id), // all of em!
    });
  };

  // --- RENDERING LOGIC ---
  // State A: Still connecting to the WebSocket server
  if (!socket || loading) {
    return <EnteringBattleground />;
  }

  if (!teamSelected && role !== Role.SPECTATOR) {
    return (
      <TeamSelect
        userId={session?.user.id as string}
        teams={teams}
        gameRoomId={gameId}
        onJoined={(teamId, role, playerCount) => {
          setTeamSelected(teamId);
          setRole(role); // TODO: add localStorage persistence
          if (role === Role.SPECTATOR) {
            setGameState(GameStatus.ACTIVE);
          }
          socket.emit("requestTeamUpdate", { teamId, playerCount });
        }}
      />
    );
  }

  if (gameState == GameStatus.STARTING) {
    return (
      <Center h="100vh">
        <Group align="center">
          <Text size="xl" c="dimmed" data-testid="waiting-for-second">
            Starting in 3...2...1...Battle!
          </Text>
          <Text size="md" fw={600}>
            Room ID: {gameId}
          </Text>
        </Group>
      </Center>
    );
  }

  if (gameState === GameStatus.WAITING) {
    return (
      <Center h="100vh">
        <Group align="center">
          <Text size="xl" c="dimmed" data-testid="waiting-for-second">
            Waiting for another player to join...
          </Text>
          <Text size="md" fw={600}>
            Room ID: {gameId}
          </Text>
        </Group>
      </Center>
    );
  }

  // Determine effective view role for rendering
  const effectiveRole =
    isSpectator && spectatorView !== Role.SPECTATOR ? spectatorView : role;
  const showGameUI = !isSpectator || spectatorView !== Role.SPECTATOR;

  return (
    <Box style={{ position: "relative", height: "100vh" }}>
      {/* Waiting Modal */}
      <Modal
        opened={isWaitingForOtherTeam}
        onClose={() => {}}
        centered
        withCloseButton={false}
        closeOnEscape={false}
        closeOnClickOutside={false}
      >
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg" fw={500}>
              Waiting for other team to submit...
            </Text>
          </Stack>
        </Center>
      </Modal>

      {/* Spectator view switcher buttons */}
      {/* spectator view bug for 4PLAYER (Teams ordered wrong?) */}
      {isSpectator && (
        <Box
          data-testid="spectating-box"
          style={{ position: "absolute", top: 12, left: 12, zIndex: 20 }}
        >
          {teams.map((team, i) => (
            <Group key={team.teamId} gap="xs">
              <Button
                data-testid={`team-${i + 1}-coder`}
                size="sm"
                onClick={() => {
                  setTeamSelected(team.teamId);
                  setSpectatorView(Role.CODER);
                  console.log("Effective role: ", effectiveRole);
                }}
              >
                Team {i + 1} Coder
              </Button>
              <Button
                data-testid={`team-${i + 1}-tester`}
                size="sm"
                onClick={() => {
                  setTeamSelected(team.teamId);
                  setSpectatorView(Role.TESTER);
                  console.log("Effective role: ", effectiveRole);
                }}
              >
                Team {i + 1} Tester
              </Button>
            </Group>
          ))}
          <Button
            className={styles.spectatorButton}
            data-testid="exit-spectator"
            size="sm"
            onClick={() => {
              setTeamSelected(null);
              setSpectatorView(Role.SPECTATOR);
            }}
          >
            Exit View
          </Button>
        </Box>
      )}

      {/* Spectator waiting message */}
      {isSpectator && spectatorView === Role.SPECTATOR && (
        <Center h="100vh">
          <Text data-testid="spectating-words" size="xl" c="dimmed">
            The room is full. You are spectating.
          </Text>
        </Center>
      )}

      {/* Main game UI */}
      {showGameUI && (
        <Box
          data-testid={
            effectiveRole === Role.CODER ? "coder-pov" : "tester-pov"
          }
          h="100vh"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <RoleFlipPopup gameState={gameState} />

          <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <PanelGroup orientation="horizontal">
              {/* Left Sidebar - Problem Box */}
              <Panel
                defaultSize={isProblemVisible ? 300 : 70}
                minSize={isProblemVisible ? 15 : 70}
                maxSize={isProblemVisible ? undefined : 70}
                collapsible={false}
              >
                <Box
                  style={{
                    height: "100%",
                    backgroundColor: "#333",
                    color: "white",
                    padding: "0",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: isProblemVisible ? "flex-start" : "center",
                  }}
                >
                  {(gameState === GameStatus.ACTIVE ||
                    gameState === GameStatus.FLIPPING) && (
                    <Box mb="md" p="1rem" pb={isProblemVisible ? "md" : "1rem"}>
                      <GameTimer
                        endTime={endTime}
                        onExpire={() => {
                          if (role === Role.CODER)
                            socket.emit("submitCode", {
                              roomId: gameId,
                              code: liveCode,
                            });
                        }}
                      />
                    </Box>
                  )}
                  {isProblemVisible ? (
                    <Box
                      style={{
                        width: "100%",
                        flex: 1,
                        minHeight: 0,
                        padding: "0 1rem 1rem 1rem",
                      }}
                    >
                      <ProblemBox
                        problem={problem}
                        onToggleVisibility={toggleProblemVisibility}
                      />
                    </Box>
                  ) : (
                    <Tooltip label="Show Problem">
                      <ActionIcon
                        variant="transparent"
                        color="gray"
                        size="xl"
                        onClick={toggleProblemVisibility}
                        title="Show Problem"
                      >
                        <IconEye size={24} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Box>
              </Panel>

              {isProblemVisible && (
                <PanelResizeHandle className={styles.panelResizeHandleCol} />
              )}

              {/* Main Workspace */}
              <Panel minSize={30}>
                <Box
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  {/* Toolbar */}
                  <Group p="xs">
                    <Select
                      size="xs"
                      data={["Javascript"]}
                      defaultValue="Javascript"
                      disabled={isSpectator || role !== Role.CODER}
                    />
                    {effectiveRole === Role.CODER && (
                      <>
                        <Button
                          size="xs"
                          color="cyan"
                          disabled={isSpectator || isWaitingForOtherTeam}
                          className={styles.runButton}
                          onClick={() =>
                            posthog.capture("code_run_triggered", { gameId })
                          }
                          rightSection={
                            <IconPlayerPlay
                              size={"var(--mantine-font-size-md)"}
                            />
                          }
                        >
                          RUN
                        </Button>
                        <Button
                          size="xs"
                          color="green"
                          onClick={submitFinalCode}
                          disabled={isSpectator || isWaitingForOtherTeam}
                        >
                          {isWaitingForOtherTeam
                            ? "Waiting for other team..."
                            : "Submit Final Code"}
                        </Button>
                      </>
                    )}
                  </Group>

                  {/* Vertical split: (Editor + Chat) and (Test Cases) */}
                  <Box style={{ flex: 1, minHeight: 0 }}>
                    <PanelGroup orientation="vertical">
                      {/* Top Section: Editor & Chat */}
                      <Panel defaultSize={55} minSize={25}>
                        <PanelGroup orientation="horizontal">
                          {/* Code Editor */}
                          <Panel defaultSize={70} minSize={40}>
                            <Box style={{ height: "100%" }}>
                              <Editor
                                height="100%"
                                theme="vs-dark"
                                defaultLanguage="javascript"
                                value={liveCode}
                                onChange={
                                  !isSpectator ? handleEditorChange : undefined
                                }
                                options={{
                                  readOnly: isSpectator || role !== Role.CODER,
                                  domReadOnly:
                                    isSpectator || role !== Role.CODER,
                                  minimap: { enabled: false },
                                }}
                              />
                            </Box>
                          </Panel>

                          <PanelResizeHandle
                            className={styles.panelResizeHandleCol}
                          />

                          {/* Chat Box */}
                          <Panel defaultSize={30} minSize={15}>
                            <Box style={{ height: "100%" }}>
                              <ChatBox
                                socket={socket as Socket}
                                roomId={teamSelected as string}
                                userName={session?.user.name as string}
                                isSpectator={isSpectator}
                                role={role}
                              />
                            </Box>
                          </Panel>
                        </PanelGroup>
                      </Panel>

                      <PanelResizeHandle
                        className={styles.panelResizeHandleRow}
                      />

                      {/* Bottom Section: Test Cases / Console */}
                      {effectiveRole === Role.TESTER && (
                        <Panel defaultSize={25} minSize={20}>
                          <Box
                            style={{
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              minHeight: 0,
                            }}
                          >
                            <Box
                              p="xs"
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                minHeight: 0,
                                flex: 1,
                              }}
                            >
                              <Stack style={{ minHeight: 0, flex: 1 }}>
                                <Group justify="space-between">
                                  <Tabs
                                    value={String(selectedTestId)}
                                    onChange={val => {
                                      setActiveTestId(+(val ?? 0));
                                    }}
                                    variant="outline"
                                  >
                                    <Tabs.List>
                                      {testCaseCtx.cases.map((test, idx) => (
                                        <Tabs.Tab
                                          key={idx}
                                          value={String(test.id)}
                                        >
                                          Test {idx + 1}
                                        </Tabs.Tab>
                                      ))}

                                      {testCaseCtx.cases.length < 5 &&
                                        !isSpectator && (
                                          <Tooltip label="New Test">
                                            <ActionIcon
                                              variant="subtle"
                                              color="gray"
                                              onClick={addNewTest}
                                              size="sm"
                                              style={{ alignSelf: "center" }}
                                              ml="xs"
                                              disabled={isWaitingForOtherTeam}
                                            >
                                              <IconPlus />
                                            </ActionIcon>
                                          </Tooltip>
                                        )}
                                    </Tabs.List>
                                  </Tabs>

                                  <Group gap="xs">
                                    <NewParameterButton
                                      onNewParameter={handleNewParameter}
                                    />
                                    <Button
                                      size="compact-sm"
                                      variant="filled"
                                      disabled={
                                        isSpectator ||
                                        runningAllTests ||
                                        isWaitingForOtherTeam
                                      }
                                      loading={runningAllTests}
                                      onClick={handleRunAllTests}
                                      rightSection={
                                        <IconPlayerTrackNextFilled size="var(--mantine-font-size-lg)" />
                                      }
                                    >
                                      Run All
                                    </Button>
                                  </Group>
                                </Group>

                                {(() => {
                                  const currentTestCase = testCaseCtx.cases.find(
                                    (t) => t.id === selectedTestId,
                                  );
                                  return currentTestCase ? (
                                    <GameTestCase
                                      testableCase={currentTestCase}
                                      onTestCaseChange={handleTestBoxChange}
                                      onParameterDelete={handleParameterDelete}
                                      onTestCaseDelete={removeTest}
                                      showDelete={
                                        testCaseCtx.cases.length !== 1
                                      }
                                      disabled={runningAllTests}
                                      onExpectedOutputTypeChange={
                                        handleExpectedOutputTypeChange
                                      }
                                    />
                                  ) : null;
                                })()}
                              </Stack>
                            </Box>
                          </Box>
                        </Panel>
                      )}
                    </PanelGroup>
                  </Box>
                </Box>
              </Panel>
            </PanelGroup>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function EnteringBattleground() {
  return (
    <Center h="100vh">
      <Group>
        <Loader color="blue" type="bars" />
        <Text size="xl" fw={500}>
          Entering BattleGround...
        </Text>
      </Group>
    </Center>
  );
}
