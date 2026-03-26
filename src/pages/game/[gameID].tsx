import { ActionIcon, Box, Button, Center, Group, Loader, Select, Tabs, Text, Tooltip } from '@mantine/core';
import { Editor } from '@monaco-editor/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { IconEye } from '@tabler/icons-react';

import ChatBox from '@/components/ChatBox';
import GameTimer from '@/components/GameTimer';
import Navbar from '@/components/Navbar';
import type { ActiveProblem } from '@/components/ProblemBox';
import ProblemBox from '@/components/ProblemBox';
import React from 'react';

interface RoomDetailsResponse {
  problem: ActiveProblem;
}

// TODO: this route should be auth checked (only allow signed-in users to join, not anyone with the URL). See CODEBAT-56
export default function PlayGameRoom() {
  // 1. Grab the ID from the URL (e.g., "624")
  const router = useRouter();
  const gameId = router.query.gameID as string;

  // 2. Set up our state for the socket connection and the user's role
  const [role, setRole] = useState<'coder' | 'tester' | 'spectator' | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<"Waiting" | "In Progress" | "Completed">("Waiting");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [problem, setProblem] = useState<ActiveProblem | null>(null);

  const [liveCode, setLiveCode] = useState<string>("// Waiting for code...");

  const [testCases, setTestCases] = useState([{ id: "1", content: "// Write Test 1 here..." }]);
  const [activeTab, setActiveTab] = useState<string | null>("1");

  const [spectatorView, setSpectatorView] = useState<'none' | 'coder' | 'tester'>('none');

  const [isProblemVisible, setIsProblemVisible] = useState(true); // State to manage problem box visibility
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev); // Function to toggle visibility


  const isSpectator = role === 'spectator';

  // ONLY HAPPENS ON PAGE LAUNCH
  useEffect(() => {
    if (!gameId) return;

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

    loadProblem();

    // 3. Initialize the connection to our custom server.js backend
    const socketInstance = io();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance);

    // 4. Ask the server to put us in the room for this specific game
    // sends a signal to the server that we want to join a specific game room, identified by gameId
    socketInstance.emit('joinGame', gameId);

    socketInstance.on('waitingForTester', () => {
      setGameState("Waiting");
    });

    socketInstance.on('spectator', () => {
      setGameState("In Progress");
    })

    socketInstance.on('gameStarted', ({ start, _duration }) => {
      if (isNaN(start) || isNaN(_duration)) return;
      setTimeRemaining(Number(start));
      setDuration(Number(_duration));
      setGameState("In Progress");
    });

    socketInstance.on("gameEnded", () => {
      setGameState("Completed");
    });

    // 5. Wait for the server to reply with our role (coder, tester, or spectator)
    socketInstance.on('roleAssigned', (assignedRole) => {
      setRole(assignedRole);
    });

    // 6. Cleanup: disconnect the socket if the user leaves the page
    return () => {
      socketInstance.disconnect();
    };
  }, [gameId]);

  useEffect(() => {
    if (role === 'coder' || !socket) return;

    const handler = (newCode: string) => setLiveCode(newCode);

    socket.on("receiveCodeUpdate", handler);
    return () => {
      socket.off("receiveCodeUpdate", handler);
    };
  }, [socket, role]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && role === 'coder' && socket) {
      socket.emit("codeChange", { roomId: gameId, code: value });
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
      router.push(`/results/${gameId}`);
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

  // --- RENDERING LOGIC ---

  // State A: Still connecting to the WebSocket server
  if (!role || !socket) {
    return (
      <Center h="100vh">
        <Group>
          <Loader color="blue" type="bars" />
          <Text size="xl" fw={500}>Entering BattleGround {gameId}...</Text>
        </Group>
      </Center>
    );
  }

  if (gameState === "Waiting") {
    return (
      <Center h="100vh">
        <Group align="center">
          <Text size="xl" c="dimmed">Waiting for another player to join...</Text>
          <Text size="md" fw={600}>Room ID: {gameId}</Text>
        </Group>
      </Center>
    );
  }

  // Determine effective view role for rendering
  const effectiveRole = isSpectator && spectatorView !== 'none' ? spectatorView : role;
  const showGameUI = !isSpectator || spectatorView !== 'none';

  return (
    <Box style={{ position: 'relative', height: '100vh' }}>
      {/* Spectator view switcher buttons */}
      {isSpectator && (
        <Box style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
          <Group gap="xs">
            <Button size="sm" onClick={() => setSpectatorView('coder')}>View Coder</Button>
            <Button size="sm" onClick={() => setSpectatorView('tester')}>View Tester</Button>
            <Button size="sm" onClick={() => setSpectatorView('none')}>Exit View</Button>
          </Group>
        </Box>
      )}

      {/* Spectator waiting message */}
      {isSpectator && spectatorView === 'none' && (
        <Center h="100vh">
          <Text size="xl" c="dimmed">The room is full. You are spectating.</Text>
        </Center>
      )}

      {/* Main game UI */}
      {showGameUI && (
        <Box h="100vh" style={{ display: "flex", flexDirection: "column" }}>
          <Navbar
            links={["Timer", "Players", "Tournament"]}
            title={`CODE BATTLEGROUNDS | GAMEMODE: TIMER | YOUR ROLE: ${effectiveRole?.toUpperCase()}`}
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
              {gameState === "In Progress" && (
                <Box p="1rem" pb={isProblemVisible ? "md" : "1rem"}>
                  <GameTimer _timeRemaining={timeRemaining} duration={duration}
                  onExpire={()=> socket.emit("submitCode", { roomId: gameId, code: liveCode })} />
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
                  disabled={isSpectator || role !== 'coder'}
                />
                {(effectiveRole === 'coder') && (
                  <>
                    <Button size="xs" color="cyan" disabled={isSpectator}>
                      RUN ▷
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
                      readOnly: isSpectator || role !== 'coder',
                      domReadOnly: isSpectator || role !== 'coder',
                      minimap: { enabled: false }
                    }}
                  />
                </Box>
                <Box style={{ width: "30%", minWidth: "200px" }}>
                  <ChatBox
                    socket={socket}
                    roomId={gameId}
                    role={role === 'coder' ? "Coder" : role === 'tester' ? "Tester" : "Spectator"}
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
                {effectiveRole === 'tester' && (
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
                        <Button size="compact-xs" variant="outline" color="gray" disabled={isSpectator}>
                          Debug
                        </Button>
                        <Button size="compact-xs" variant="filled" color="blue" disabled={isSpectator}>
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
                    defaultLanguage="javascript"
                    options={{
                      readOnly: role !== 'tester',
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

  // State C: Successfully joined as a player! Render the correct layout.
  // return (
  //   <>
  //     {role === 'coder' && (
  //       <CoderPOV
  //         socket={socket}
  //         roomId={gameId}
  //         timeRemaining={timeRemaining}
  //         duration={duration}
  //         gameState={gameState}
  //         problem={problem}
  //       />
  //     )}
  //     {role === 'tester' && (
  //       <TesterPOV
  //         socket={socket}
  //         roomId={gameId}
  //         timeRemaining={timeRemaining}
  //         duration={duration}
  //         gameState={gameState}
  //         problem={problem}
  //       />
  //     )}
  //   </>
  // );
}
