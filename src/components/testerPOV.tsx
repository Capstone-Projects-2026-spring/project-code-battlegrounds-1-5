import React, { useEffect, useState } from "react";
import { Box, Group, Button, Select, Text, Tabs, ActionIcon, Center } from "@mantine/core";
import Editor from "@monaco-editor/react";
import Navbar from "@/components/Navbar";
import ProblemBox from "@/components/ProblemBox";
import ChatBox from "@/components/ChatBox";
import GameTimer from "@/components/GameTimer";
import { Socket } from "socket.io-client";
import { IconEye } from "@tabler/icons-react";

interface TesterPOVProps {
  socket: Socket;
  roomId: string;
  timeRemaining: number;
  duration: number;
  gameState: "Waiting" | "In Progress" | "Completed";
  isSpectator?: boolean;
}

export default function TesterPOV({
  socket,
  roomId,
  timeRemaining,
  duration,
  gameState,
  isSpectator = false,
}: TesterPOVProps) {
  // Add state to manage the visibility of the problem panel.
  const [isProblemVisible, setIsProblemVisible] = useState(true);
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev);

  const [liveCode, setLiveCode] = useState("// Waiting for coder...");
  const [testCases, setTestCases] = useState([{ id: "1", content: "// Write Test 1 here..." }]);
  const [activeTab, setActiveTab] = useState<string | null>("1");

  useEffect(() => {
    const handler = (newCode: string) => setLiveCode(newCode);
    socket.on("receiveCodeUpdate", handler);
    return () => { socket.off("receiveCodeUpdate", handler); };
  }, [socket]);

  const addNewTest = () => {
    if (testCases.length < 5) {
      const newId = (testCases.length + 1).toString();
      setTestCases([...testCases, { id: newId, content: `// Write Test ${newId} here...` }]);
      setActiveTab(newId);
    }
  };

  return (
    <Box h="100vh" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Navbar
        links={["Timer", "Players", "Tournament"]}
        title="CODE BATTLEGROUNDS | GAMEMODE: TIMER"
        isSpectator={isSpectator}
      />

      <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Add sidebar which contains the problem text and timer and hides problem text when collapsed */}
        <Box
          style={{
            width: isProblemVisible ? "25%" : "50px",
            minWidth: isProblemVisible ? "250px" : "50px",
            maxWidth: "400px",
            backgroundColor: "#333",
            color: "white",
            padding: isProblemVisible ? "0" : "0",
            overflowY: "auto",
            display: "flex",
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: isProblemVisible ? 'flex-start' : 'center',
            flexShrink: 0,
            transition: 'width 0.2s ease, min-width 0.2s ease', // Add a smooth transition
          }}
        >
          {/* The Game Timer will be placed within it's own persistent box component to prevent state reset */}
          {gameState === "In Progress" && (
            <Box p="1rem" pb={isProblemVisible ? "md" : "1rem"}>
              <GameTimer _timeRemaining={timeRemaining} duration={duration} />
            </Box>
          )}
          {/* Conditionally render either the ProblemBox or the "Show" icon inside the persistent sidebar. */}
          {isProblemVisible ? (
            <Box style={{ width: '100%', flex: 1, minHeight: 0, padding: '0 1rem 1rem 1rem' }}><ProblemBox onToggleVisibility={toggleProblemVisibility} /></Box>
          ) : (
            <ActionIcon variant="transparent" color="gray" size="xl" onClick={toggleProblemVisibility} title="Show Problem">
              <IconEye size={24} />
            </ActionIcon>
          )}
        </Box>

        {/* Workspace */}
        <Box style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Group p="xs" bg="#f8f9fa" style={{ borderBottom: "1px solid #ddd", flexShrink: 0 }}>
            <Select size="xs" data={["Javascript"]} defaultValue="Javascript" disabled style={{ width: 120 }} />
            <Text size="xs" c="dimmed">|</Text>
            <Button size="xs" color="cyan" disabled={isSpectator}>RUN ▷</Button>
            <Button size="xs" variant="subtle" color="gray" disabled={isSpectator}>Submit</Button>
          </Group>

          {/* Middle Row: Code Watcher & Chat */}
          <Box style={{ display: "flex", flex: "1 1 45%", borderBottom: "2px solid #333", minHeight: 0 }}>
            <Box style={{ flex: 1, borderRight: "1px solid #ddd", minWidth: 0 }}>
              <Editor
                height="100%"
                theme="vs-light"
                language="javascript"
                value={liveCode}
                options={{ readOnly: true, domReadOnly: true, minimap: { enabled: false } }}
              />
            </Box>
            <Box style={{ width: "30%", minWidth: "200px", flexShrink: 0 }}>
              <ChatBox socket={socket} roomId={roomId} role="Quality" isSpectator={isSpectator} />
            </Box>
          </Box>

          {/* Bottom Row: Testing Board */}
          <Box style={{ flex: "1 1 40%", backgroundColor: "#1e1e1e", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Box p="xs" style={{ borderBottom: "1px solid #444" }}>
              <Group justify="space-between">
                <Tabs value={activeTab} onChange={setActiveTab} variant="outline" color="gray">
                  <Tabs.List>
                    {testCases.map((test) => (
                      <Tabs.Tab key={test.id} value={test.id} style={{ color: "white" }}>Test {test.id}</Tabs.Tab>
                    ))}
                    {testCases.length < 5 && !isSpectator && (
                      <Button variant="subtle" size="compact-xs" color="gray" onClick={addNewTest}>+</Button>
                    )}
                  </Tabs.List>
                </Tabs>
                <Group gap="xs">
                  <Button size="compact-xs" variant="outline" color="gray" disabled={isSpectator}>Debug</Button>
                  <Button size="compact-xs" variant="filled" color="blue" disabled={isSpectator}>Run Test</Button>
                </Group>
              </Group>
            </Box>
            <Box style={{ flex: 1 }}>
              <Editor 
                height="100%" 
                theme="vs-dark" 
                defaultLanguage="javascript" 
                options={{ readOnly: isSpectator, minimap: { enabled: false }, fontSize: 13 }} 
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}