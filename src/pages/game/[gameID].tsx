import { ActionIcon, Box, Button, Center, Group, Loader, Select, Stack, Tabs, Text, Tooltip } from '@mantine/core';
import { Editor } from '@monaco-editor/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { IconEye, IconPlayerPlay, IconPlayerTrackNextFilled, IconPlus } from '@tabler/icons-react';

import ChatBox from '@/components/ChatBox';
import GameTimer from '@/components/GameTimer';
import Navbar from '@/components/Navbar';
import TeamSelect from "@/components/TeamSelect";
import { TeamCount } from "@/components/TeamSelect";
import type { ActiveProblem } from '@/components/ProblemBox';
import ProblemBox from '@/components/ProblemBox';
import RoleFlipPopup from '@/components/RoleFlipPopup';
import { showRoleSwapWarning } from '@/components/notifications';

import { Role, GameStatus, GameType } from "@prisma/client";
import { authClient } from "@/lib/auth-client";
import GameTestCase from '@/components/gameTests/GameTestCase';
import { GameTestCasesProvider, TestableCase, useTestCases } from "@/components/gameTests/GameTestCasesContext";
import { ParameterType } from '@/lib/ProblemInputOutput';
import NewParameterButton from '@/components/gameTests/NewParameterButton';

interface RoomDetailsResponse {
  problem: ActiveProblem;
  gameType: GameType;
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
      router.replace("/auth");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return <EnteringBattleground />;
  }

  return (
    <GameTestCasesProvider>
      <PlayGameRoom />
    </GameTestCasesProvider>
  );
}

function PlayGameRoom() {
  // 1. Grab the ID from the URL (e.g., "624")
  const router = useRouter();
  const gameId = router.query.gameID as string;
  const { data: session } = authClient.useSession();

  // 2. Set up our state for the socket connection and the user's role
  const [role, setRole] = useState<Role | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameStatus>(GameStatus.WAITING);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<ActiveProblem | null>(null);
  const [teams, setTeams] = useState<TeamCount[]>([]);
  const [teamSelected, setTeamSelected] = useState<string | null>(null);
  const [liveCode, setLiveCode] = useState<string>("// Waiting for code...");
  const [activeTestId, setActiveTestId] = useState<number>(0);
  const [gameType, setGameType] = useState<GameType | null>(null);

  // Context <3
  const testCaseCtx = useTestCases();

  const [spectatorView, setSpectatorView] = useState<Role>(Role.SPECTATOR);

  const endTimeRef = useRef<number | null>(null);
  const [endTime, setEndTime] = useState(0);
  const [isProblemVisible, setIsProblemVisible] = useState(true); // State to manage problem box visibility
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev); // Function to toggle visibility

  const socketRef = useRef<Socket | null>(null);

  const isSpectator = role === Role.SPECTATOR;

  // ONLY HAPPENS ON PAGE LAUNCH
  useEffect(() => {
    if (!session?.user.id || !gameId || socketRef.current) return;

    const loadRoomDetails = async () => {
      try {
        const response = await fetch(`/api/rooms/${gameId}/${session.user.id}`);
        if (!response.ok) return;
        const data = (await response.json()) as RoomDetailsResponse;
        setProblem(data.problem as ActiveProblem);
        setGameType(data.gameType as GameType);
        setTeams(data.teams as TeamCount[]);
        if (data.teamId) setTeamSelected(data.teamId as string);
        if (data.role) setRole(data.role as Role);
        console.log("Fetched room details:", data);

        if (data.gameType === GameType.TWOPLAYER && !data.teamId && !data.role) {
          // Auto-join team if it's a 2 player game and the user isn't assigned to a team yet
          const teamId = data.teams[0]?.teamId;
          if (teamId) {
            const res = await fetch(`/api/team/join`, {
              method: "POST",
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: session.user.id, teamId, gameRoomId: gameId })
            });
            if (res.ok) {
              const joined = await res.json();
              setTeamSelected(teamId);
              setRole(joined.role);
            }
          }
        }

      } catch (error) {
        console.error('Failed to load room problem', error);
      }
    };
    loadRoomDetails();
    setLoading(false);

    // 3. Initialize the connection to our custom server.js backend
    const socketInstance = io();
    socketRef.current = socketInstance;
    setSocket(socketRef.current);

    socketInstance.emit("register", session.user.id);

    socketInstance.on("gameStarting", () => {
      setGameState(GameStatus.STARTING);
    });

    socketInstance.on("gameStarted", ({ start }) => {
      if (isNaN(start)) return;
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + Number(start);
        setEndTime(endTimeRef.current);
      }
      setGameState(GameStatus.ACTIVE);
    });

    socketInstance.on("gameEnded", () => {
      setGameState(GameStatus.FINISHED);
      router.push(`/results/${gameId}`);
    });

    socketInstance.on("roleSwapWarning", () => {
      if (role) {
        showRoleSwapWarning(role);
      } else {
        showRoleSwapWarning(Role.CODER); 
      }
    });

    socketInstance.on("roleSwapping", () => {
      setGameState(GameStatus.FLIPPING);
    });

    socketInstance.on("roleSwap", () => {
      setGameState(GameStatus.ACTIVE);
      setRole((prev) => (prev === Role.SPECTATOR ? Role.SPECTATOR : prev === Role.CODER ? Role.TESTER : Role.CODER));
    });

    // This is so if another person picks while someone is deciding
    socketInstance.on("teamUpdated", ({ teamId, playerCount }) => {
      setTeams((prev) =>
        prev.map((t) => (t.teamId === teamId ? { ...t, playerCount } : t)),
      );
    });

    // 6. Cleanup: disconnect the socket if the user leaves the page
    return () => {
      socketInstance.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, session?.user.id]);

  useEffect(() => {
    // Runs after team gets selected
    if (!socket || !teamSelected || !gameId || !gameType) return;
    socket.emit("joinGame", { gameId, teamId: teamSelected, gameType });
  }, [socket, teamSelected, gameId, gameType]);

  useEffect(() => {
    if (!socket || !role || !teamSelected) return;
    socket.emit('requestCodeSync', { teamId: teamSelected });
    socket.emit('requestTestCaseSync', { teamId: teamSelected });

    const testHandler = (cases: TestableCase[]) => {
      console.log("Receiving test case sync!", cases);
      testCaseCtx.setCases(cases);
    };
    socket.on('receiveTestCaseSync', testHandler);

    const handler = (newCode: string) => setLiveCode(newCode);
    socket.on("receiveCodeUpdate", handler);

    return () => {
      socket.off("receiveTestCaseSync", testHandler);
      socket.off("receiveCodeUpdate", handler);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, role, teamSelected]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && role === Role.CODER && socket) {
      socket.emit("codeChange", { teamId: teamSelected, code: value });
    }
  };


  const submitFinalCode = () => {
    //Send bother Coder and Tester to the results page
    //TODO Store submission and evaluate results on the backend, then fetch and display here
    //server broadcasts the event to both player
    if (!socket) return; //make sure the socket is connected before emitting
    socket.emit("submitCode", { roomId: teamSelected, code: liveCode });
  };

  const addNewTest = () => {
    if (testCaseCtx.cases.length >= 5) return;

    // const newId = testCaseCtx.cases.length; // zero-based index
    const newId = testCaseCtx.cases
      .map(c => c.id)
      .reduce((prev, acc) => Math.max(prev, acc))
      + 1;
    console.log("creating new test with id", newId);
    const newCase: TestableCase = {
      id: newId,
      functionInput: testCaseCtx.parameters
        .filter(p => !p.isOutputParameter)
        .map(c => ({
          ...c,
          value: null
        })),
      expectedOutput: {
        ...testCaseCtx.parameters
          .find(p => p.isOutputParameter)!,
        value: null
      },
    };
    testCaseCtx.addCase(newCase);

    setActiveTestId(newId);
    console.log("emitting new test cases", [...testCaseCtx.cases, newCase]);
    socket?.emit("updateTestCases", { teamId: teamSelected, testCases: [...testCaseCtx.cases, newCase] });
  };

  const removeTest = (testId: TestableCase["id"]) => {
    if (testCaseCtx.cases.length === 1) return;

    const newId = testCaseCtx.cases
      .map(c => c.id)
      .reduce((prev, acc) => Math.min(prev, acc));
    console.log(`removing test with id ${testId}`, `min id ${newId}`);
    testCaseCtx.removeCase(testId);

    setActiveTestId(newId);
    console.log("emitting new test cases", [...testCaseCtx.cases.filter(c => c.id !== testId)]);
    socket?.emit("updateTestCases", { teamId: teamSelected, testCases: [...testCaseCtx.cases.filter(c => c.id !== testId)] });
  };

  const handleNewParameter = (parameter: ParameterType) => {
    const cases = testCaseCtx.cases;
    const newCases = cases.map(c => ({
      ...c,
      functionInput: [
        ...c.functionInput,
        parameter
      ]
    }));
    console.log("emitting new test cases", newCases);
    testCaseCtx.setParameters(prev => [...prev, parameter]);
    testCaseCtx.setCases(newCases);
    socket?.emit("updateTestCases", { teamId: teamSelected, testCases: newCases });
  };

  const handleParameterDelete = (parameter: ParameterType) => {
    const cases = testCaseCtx.cases;
    const newCases = cases.map(c => ({
      ...c,
      functionInput: c.functionInput.filter(i => i.name !== parameter.name)
    }));
    console.log("emitting new test cases", newCases);
    testCaseCtx.setParameters(prev => prev.filter(p => p.name !== parameter.name));
    testCaseCtx.setCases(newCases);
    socket?.emit("updateTestCases", { teamId: teamSelected, testCases: newCases });
  };

  const handleTestBoxChange = (testCase: TestableCase) => {
    if (role !== Role.TESTER || !socket) return;
    const updated = testCaseCtx.cases.map(t => t.id === activeTestId ? testCase : t);
    testCaseCtx.setCases(updated);
    socket.emit('updateTestCases', { teamId: teamSelected, testCases: updated });
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
          socket.emit('requestTeamUpdate', { teamId, playerCount });
        }}
      />
    );
  }

  if (gameState == GameStatus.STARTING) {
    return (
      <Center h="100vh">
        <Group align="center">
          <Text size="xl" c="dimmed" data-testid="waiting-for-second">Starting in 3...2...1...Battle!</Text>
          <Text size="md" fw={600}>Room ID: {gameId}</Text>
        </Group>
      </Center>
    );
  }

  if (gameState === GameStatus.WAITING) {
    return (
      <Center h="100vh">
        <Group align="center">
          <Text size="xl" c="dimmed" data-testid="waiting-for-second">Waiting for another player to join...</Text>
          <Text size="md" fw={600}>Room ID: {gameId}</Text>
        </Group>
      </Center>
    );
  }

  // Determine effective view role for rendering
  const effectiveRole = isSpectator && spectatorView !== Role.SPECTATOR ? spectatorView : role;
  const showGameUI = !isSpectator || spectatorView !== Role.SPECTATOR;

  return (
    <Box style={{ position: 'relative', height: '100vh' }}>
      {/* Spectator view switcher buttons */}
      {/* spectator view bug for 4PLAYER (Teams ordered wrong?) */}
      {isSpectator && (
        <Box data-testid="spectating-box" style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
          {teams.map((team, i) => (
            <Group key={team.teamId} gap="xs">
              <Button data-testid={`team-${i + 1}-coder`} size="sm" onClick={() => { 
                setTeamSelected(team.teamId);
                setSpectatorView(Role.CODER); 
                console.log("Effective role: ", effectiveRole);
              }}>
                Team {i + 1} Coder
              </Button>
              <Button data-testid={`team-${i + 1}-tester`} size="sm" onClick={() => { 
                setTeamSelected(team.teamId);
                setSpectatorView(Role.TESTER);
                console.log("Effective role: ", effectiveRole); 
              }}>
                Team {i + 1} Tester
              </Button>
            </Group>
          ))}
          <Button
            data-testid="exit-spectator"
            size="sm"
            onClick={() => {setTeamSelected(null); setSpectatorView(Role.SPECTATOR)}}
          >
            Exit View
          </Button>
        </Box>
      )}

      {/* Spectator waiting message */}
      {isSpectator && spectatorView === Role.SPECTATOR && (
        <Center h="100vh">
          <Text data-testid="spectating-words" size="xl" c="dimmed">The room is full. You are spectating.</Text>
        </Center>
      )}

      {/* Main game UI */}
      {showGameUI && (
        <Box data-testid={(effectiveRole === Role.CODER) ? "coder-pov" : "tester-pov"} h="100vh" style={{ display: "flex", flexDirection: "column" }}>
          <RoleFlipPopup gameState={gameState} />
          <Navbar
            links={["Timer", "Players", "Tournament"]}
            title="CODE BATTLEGROUNDS | GAMEMODE: TIMER"
            isSpectator={isSpectator}
          />

          <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Left Sidebar */}
            <Box
              style={{
                // Dynamic width based on visibility state
                width: isProblemVisible ? "20%" : "50px",
                minWidth: isProblemVisible ? "250px" : "50px",
                backgroundColor: "#333",
                color: "white",
                padding: "0",
                overflowY: "auto",
                display: "flex",
                flexDirection: 'column',
                alignItems: 'center',
                // Justify content to center the icon when collapsed
                justifyContent: isProblemVisible ? 'flex-start' : 'center',
                flexShrink: 0,
                // Smooth transition for width change
                transition: 'width 0.2s ease, min-width 0.2s ease',
              }}
            >
              {(gameState === GameStatus.ACTIVE || gameState === GameStatus.FLIPPING) && (
                <Box mb="md" p="1rem" pb={isProblemVisible ? "md" : "1rem"}>
                  <GameTimer endTime={endTime}
                  onExpire={()=> {if (role === Role.CODER) socket.emit("submitCode", { roomId: gameId, code: liveCode });}} />
                </Box>
              )}
              {/* Conditionally render either the ProblemBox or the "Show" icon */}
              {isProblemVisible ? (
                <Box style={{ width: '100%', flex: 1, minHeight: 0, padding: '0 1rem 1rem 1rem' }}>
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

            {/* Main Workspace */}
            <Box
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              {/* Toolbar */}
              <Group
                p="xs"
                // bg="#f8f9fa"
                style={{ borderBottom: "1px solid #ddd", flexShrink: 0 }}
              >
                <Select
                  size="xs"
                  data={["Javascript"]}
                  defaultValue="Javascript"
                  disabled={isSpectator || role !== Role.CODER}
                />
                {(effectiveRole === Role.CODER) && (
                  <>
                    <Button
                      size="xs"
                      color="cyan"
                      disabled={isSpectator}
                      rightSection={<IconPlayerPlay size={"var(--mantine-font-size-md)"} />}
                    >
                      RUN
                    </Button>
                    <Button size="xs" color="green" onClick={submitFinalCode} disabled={isSpectator}>
                      Submit Final Code
                    </Button>
                  </>
                )}
              </Group>

              {/* Middle Row: Editor & Chat */}
              <Box
                style={{
                  display: "flex",
                  flex: "1 1 45%",
                  borderBottom: "2px solid #333",
                  minHeight: 0,
                }}
              >
                <Box style={{ flex: 1, borderRight: "1px solid #ddd", minWidth: 0 }}>
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    defaultLanguage="javascript"
                    value={liveCode}
                    onChange={!isSpectator ? handleEditorChange : undefined}
                    options={{
                      readOnly: isSpectator || role !== Role.CODER,
                      domReadOnly: isSpectator || role !== Role.CODER,
                      minimap: { enabled: false }
                    }}
                  />
                </Box>
                <Box style={{ width: "30%", minWidth: "200px" }}>
                  <ChatBox
                    socket={socket as Socket}
                    roomId={teamSelected as string}
                    userName={session?.user.name as string}
                    isSpectator={isSpectator}
                  />
                </Box>
              </Box>

              {/* Bottom Row: Console / Test Cases */}
              <Box
                style={{
                  flex: "1 1 35%",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }}
              >
                {effectiveRole === Role.TESTER && (
                  <Box p="xs" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
                    <Stack style={{ minHeight: 0, flex: 1 }}>
                      <Group justify="space-between">
                        <Tabs
                          value={String(activeTestId)}
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

                            {testCaseCtx.cases.length < 5 && !isSpectator && (
                              <Tooltip label="New Test">
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  onClick={addNewTest}
                                  size="sm"
                                  style={{ alignSelf: "center" }}
                                  ml="xs"
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
                            color="green"
                            disabled={isSpectator}
                            rightSection={
                              <IconPlayerTrackNextFilled
                                size="var(--mantine-font-size-lg)"
                              />
                            }
                          >
                            Run All
                          </Button>
                        </Group>
                      </Group>

                      {(() => {
                        const currentTestCase = testCaseCtx.cases.find(t => t.id === activeTestId);
                        return currentTestCase ? (
                          <GameTestCase
                            testableCase={currentTestCase}
                            onTestCaseChange={handleTestBoxChange}
                            onNewParameter={handleNewParameter}
                            onParameterDelete={handleParameterDelete}

                            onTestCaseDelete={removeTest}
                            showDelete={testCaseCtx.cases.length !== 1}
                          />
                        ) : null;
                      })()}
                    </Stack>
                  </Box>
                )}

                {effectiveRole === Role.CODER && (
                  <Box style={{ flex: 1 }}>
                    <Editor
                      height="100%"
                      theme="vs-dark"
                      defaultLanguage="javascript"
                      // value={""}
                      // onChange={handleTestBoxChange}
                      options={{
                        readOnly: role !== Role.TESTER,
                        minimap: { enabled: false }
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
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