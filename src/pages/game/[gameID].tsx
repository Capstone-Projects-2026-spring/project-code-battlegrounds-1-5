import { ActionIcon, Badge, Box, Button, Center, Group, Loader, Select, Tabs, Text, Tooltip } from '@mantine/core';
import { Editor } from '@monaco-editor/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { IconEye } from '@tabler/icons-react';

import ChatBox from '@/components/ChatBox';
import GameTimer from '@/components/GameTimer';
import Navbar from '@/components/Navbar';
import TeamSelect from "@/components/TeamSelect";
import { TeamCount } from "@/components/TeamSelect";
import type { ActiveProblem } from '@/components/ProblemBox';
import ProblemBox from '@/components/ProblemBox';
import RoleFlipPopup from '@/components/RoleFlipPopup';

import { Role, GameStatus } from "@prisma/client";
import { authClient } from "@/lib/auth-client";

interface RoomDetailsResponse {
  problem: ActiveProblem;
}

export default function PlayGameRoom() {
  // 1. Grab the ID from the URL (e.g., "624")
  const router = useRouter();
  const gameId = router.query.gameID as string;

  const { data: session, error, isPending } = authClient.useSession();

  // 2. Set up our state for the socket connection and the user's role
  const [role, setRole] = useState<Role | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameStatus>(GameStatus.WAITING);
  const [duration, setDuration] = useState<number>(0);
  const [problem, setProblem] = useState<ActiveProblem | null>(null);
  const [teams, setTeams] = useState<TeamCount[]>([]);
  const [teamSelected, setTeamSelected] = useState<string | null>(null);
  const [viewTeamId, setViewTeamId] = useState<string>("");

  const [liveCode, setLiveCode] = useState<string>("// Waiting for code...");

  const [testCases, setTestCases] = useState([
    { id: "1", content: "[1, 2, 3, 4, 5]" },
    { id: "2", content: "[5, 6, 7, 8, 9]" },
    { id: "3", content: "[1, 2, 3, 4]" }
  ]);
  const solvedTestCases = [
    { id: "1", content: "[1, 2, 3, 4, 5] -> 3" },
    { id: "2", content: "[5, 6, 7, 8, 9] -> 7" },
    { id: "3", content: "[1, 2, 3, 4] -> 2.5" }
  ];
  const [activeTab, setActiveTab] = useState<string | null>("1");

  const [spectatorView, setSpectatorView] = useState<Role>(Role.SPECTATOR);

  const endTimeRef = useRef<number | null>(null);
  const [isProblemVisible, setIsProblemVisible] = useState(true); // State to manage problem box visibility
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev); // Function to toggle visibility


  const isSpectator = role === Role.SPECTATOR;

  // ONLY HAPPENS ON PAGE LAUNCH
  useEffect(() => {
    if (!session?.user.id) return;
    if (!gameId) return;

    if (!isPending && !session) {
      router.push("/auth");
    }

    // fetch teams and their player counts
    const fetchCounts = async () => {
      const res = await fetch(`/api/team/count?gameId=${gameId}`);
      const data = await res.json();
      setTeams(data.teams);
    };
    fetchCounts();
    const loadProblem = async () => {
      const mock: ActiveProblem = {
        id: "mock",
        title: "Median",
        description: "Given a sorted array, find the median element in the array.",
        difficulty: "EASY",
        topics: ["Arrays"]
      }
      console.log("MOCKING QUESTION", mock);
      setProblem(mock);

      // try {
      //   const response = await fetch(`/api/rooms/${gameId}`);
      //   if (!response.ok) return;
      //   const data = (await response.json()) as RoomDetailsResponse;
      //   setProblem(data.problem);
      // } catch (error) {
      //   console.error('Failed to load room problem', error);
      // }
    };

    loadProblem();

    // 3. Initialize the connection to our custom server.js backend
    const socketInstance = io();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance);
    socketInstance.emit("register", session.user.id);

    socketInstance.on("gameStarting", () => {
      setGameState(GameStatus.STARTING);
    });

    socketInstance.on("gameStarted", ({ start, _duration }) => {
      if (isNaN(start) || isNaN(_duration)) return;
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + Number(start);
      }
      setDuration(Number(_duration));
      setGameState(GameStatus.ACTIVE);
    });

    socketInstance.on("gameEnded", () => {
      setGameState(GameStatus.FINISHED);
      router.push(`/results/${gameId}`);
    });

    socketInstance.on("roleSwapping", () => {
      setGameState(GameStatus.FLIPPING);
    });

    socketInstance.on("roleSwap", ({ teamId }) => {
      setGameState(GameStatus.ACTIVE);
      setRole((prev) => (prev === Role.CODER ? Role.TESTER : Role.CODER));
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
  }, [gameId, session, isPending, router]);

  useEffect(() => {
    // Runs after team gets selected
    console.log("Effect 2:", { socket: !!socket, teamSelected, gameId });
    if (!socket || !teamSelected || !gameId) return;
    socket.emit("joinGame", { gameId, teamId: teamSelected });
  }, [socket, teamSelected, gameId]);



  useEffect(() => {
    if (!socket || !role) return;
    socket.emit('requestCodeSync', { teamId: teamSelected });
    socket.emit('requestTestCaseSync', { teamId: teamSelected });

    socket.on('receiveTestCaseSync', (cases) => {
      setTestCases(cases);
    })

    const handler = (newCode: string) => setLiveCode(newCode);

    socket.on("receiveCodeUpdate", handler);
    return () => {
      socket.off("receiveCodeUpdate", handler);
    };
  }, [socket, role, teamSelected]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && role === Role.CODER && socket) {
      socket.emit("codeChange", { teamId: teamSelected, code: value });
    }
  };

  const addNewTest = () => {
    if (testCases.length < 5) {
      const newId = (testCases.length + 1).toString();
      setTestCases([...testCases, { id: newId, content: `// Write Test ${newId} here...` }]);
      setActiveTab(newId);
    }
  };
  //This useEffect listens for the "redirectToResults" event from the server, which signals that the game has ended and both players should be taken to the results page.
  //When the event is received, it uses Next.js's router to navigate to the /results page, passing along the gameId as a query parameter.
  //This allows both the coder and tester to see their match results after the game concludes.
  useEffect(() => {
    if (!socket) return;
    const handleRedirectToResults = () => {
      router.push(`/results?gameId=${gameId}`);
    };
    socket.on("redirectToResults", handleRedirectToResults);
    return () => {
      socket.off("redirectToResults", handleRedirectToResults);
    };
  }, [socket, gameId, router]);


  const submitFinalCode = () => {
    //Send bother Coder and Tester to the results page
    //TODO Store submission and evaluate results on the backend, then fetch and display here
    //server broadcasts the event to both players
    if (!socket) return; //make sure the socket is connected before emitting
    socket.emit("submitCode", { roomId: gameId, code: liveCode });
  };

  const handleTestBoxChange = (val: string | undefined) => {
    if (role !== Role.TESTER || !val || !socket) return;
    const updated = testCases.map(t => t.id === activeTab ? { ...t, content: val } : t);
    setTestCases(updated);
    socket.emit('updateTestCases', { teamId: teamSelected, testCases: updated });
  }

  // --- RENDERING LOGIC ---
  if (!teamSelected && role !== Role.SPECTATOR) {
    return (
      <TeamSelect
        userId={session?.user.id as string}
        teams={teams}
        gameRoomId={gameId}
        onJoined={(teamId, role) => {
          setTeamSelected(teamId);
          setGameState(GameStatus.WAITING);
          setRole(role); // TODO: add localStorage persistence
          if (role === Role.SPECTATOR) {
            setGameState(GameStatus.ACTIVE);
          }
        }}
      />
    );
  }

  // State A: Still connecting to the WebSocket server
  if (!role || !socket) {
    return (
      <Center h="100vh">
        <Group>
          <Loader color="blue" type="bars" />
          <Text size="xl" fw={500}>
            Entering BattleGround {gameId}...
          </Text>
        </Group>
      </Center>
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
      {isSpectator && (
        <Box data-testid="spectating-box" style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
          {teams.map((team, i) => (
            <Group key={team.teamId} gap="xs">
              <Button data-testid={`team-${i + 1}-coder`} size="sm" onClick={() => { setSpectatorView(Role.CODER); setViewTeamId(team.teamId); }}>
                Team {i + 1} Coder
              </Button>
              <Button data-testid={`team-${i + 1}-tester`} size="sm" onClick={() => { setSpectatorView(Role.TESTER); setViewTeamId(team.teamId); }}>
                Team {i + 1} Tester
              </Button>
            </Group>
          ))}
          <Button data-testid="exit-spectator" size="sm" onClick={() => setSpectatorView(Role.SPECTATOR)}>Exit View</Button>
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
                  <GameTimer endTime={endTimeRef.current ?? 0} duration={duration} />
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
                    {/* <Button size="xs" color="cyan" disabled={isSpectator}>
                      RUN ▷
                    </Button> */}
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
                    socket={socket}
                    roomId={gameId}
                    userName={session?.user.name as string}
                    isSpectator={isSpectator}
                  />
                </Box>
              </Box>

              {/* Bottom Row: Console / Test Cases */}
              <Box
                style={{
                  flex: "1 1 35%",
                  backgroundColor: "#1e1e1e",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }}
              >
                {effectiveRole === Role.TESTER && (
                  <Box p="xs" style={{ borderBottom: "1px solid #444" }}>
                    <Group justify="space-between">
                      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" color="gray">
                        <Tabs.List>
                          {testCases.map((test) => (
                            <Tabs.Tab key={test.id} value={test.id} style={{ color: "white" }}>
                              Test {test.id}
                            </Tabs.Tab>
                          ))}
                          {testCases.length < 5 && !isSpectator && (
                            <Button variant="subtle" size="compact-xs" color="gray" onClick={addNewTest}>
                              +
                            </Button>
                          )}
                        </Tabs.List>
                      </Tabs>
                      <Group gap="xs">
                        {/* <Button size="compact-xs" variant="outline" color="gray" disabled={isSpectator}>
                          Debug
                        </Button> */}
                        <Button
                          size="compact-xs"
                          variant="filled"
                          color="blue"
                          disabled={isSpectator}
                          onClick={() => setTestCases(solvedTestCases)}
                        >
                          Run Test
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                )}

                <Box style={{ flex: 1 }}>
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    // defaultLanguage="javascript"
                    value={role == Role.TESTER ? (testCases.find(test => test.id === activeTab)?.content ?? "") : ""}
                    onChange={handleTestBoxChange}
                    options={{
                      readOnly: role !== Role.TESTER,
                      minimap: { enabled: false }
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
