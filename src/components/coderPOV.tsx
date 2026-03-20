import { useEffect, useState } from "react";
import { Box, Group, Button, Select, Tabs } from "@mantine/core";
import Editor from "@monaco-editor/react";
import Navbar from "@/components/Navbar";
import ProblemBox, { ActiveProblem } from "@/components/ProblemBox";
import ChatBox from "@/components/ChatBox";
import GameTimer from "@/components/GameTimer";
import { Socket } from "socket.io-client";

interface CoderPOVProps {
  socket: Socket;
  roomId: string;
  timeRemaining: number;
  duration: number;
  gameState: "Waiting" | "In Progress" | "Completed";
  isSpectator?: boolean;
  problem: ActiveProblem | null;
}

export default function CoderPOV({
  socket,
  roomId,
  timeRemaining,
  duration,
  gameState,
  isSpectator = false,
  problem
}: CoderPOVProps) {
  const [activeTab, setActiveTab] = useState<string | null>("console");
  const [liveCode, setLiveCode] = useState<string>("// Waiting for code...");

  useEffect(() => {
    if (!isSpectator) return;
    const handler = (newCode: string) => setLiveCode(newCode);
    socket.on("receiveCodeUpdate", handler);
    return () => {
      socket.off("receiveCodeUpdate", handler);
    };
  }, [socket, isSpectator]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && !isSpectator) {
      socket.emit("codeChange", { roomId, code: value });
    }
  };

  return (
    <Box h="100vh" style={{ display: "flex", flexDirection: "column" }}>
      <Navbar
        links={["Timer", "Players", "Tournament"]}
        title="CODE BATTLEGROUNDS | GAMEMODE: TIMER"
        isSpectator={isSpectator}
      />

      <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Box
          style={{
            width: "20%",
            minWidth: "250px",
            backgroundColor: "#333",
            color: "white",
            padding: "1rem",
            overflowY: "auto",
            display: "block", 
          }}
        >
          {gameState === "In Progress" && (
            <Box mb="md">
              <GameTimer _timeRemaining={timeRemaining} duration={duration} />
            </Box>
          )}
          <ProblemBox problem={problem} />
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
          <Group
            p="xs"
            bg="#f8f9fa"
            style={{ borderBottom: "1px solid #ddd", flexShrink: 0 }}
          >
            <Select
              size="xs"
              data={["Javascript"]}
              defaultValue="Javascript"
              disabled={isSpectator}
            />
            <Button size="xs" color="cyan" disabled={isSpectator}>
              RUN ▷
            </Button>
            <Button size="xs" color="green" disabled={isSpectator}>
              Submit Final Code
            </Button>
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
            <Box
              style={{ flex: 1, borderRight: "1px solid #ddd", minWidth: 0 }}
            >
              <Editor
                height="100%"
                theme="vs-dark"
                defaultLanguage="javascript"
                value={isSpectator ? liveCode : undefined}
                onChange={handleEditorChange}
                options={{ readOnly: isSpectator, minimap: { enabled: false } }}
              />
            </Box>
            <Box style={{ width: "30%", minWidth: "200px" }}>
              <ChatBox
                socket={socket}
                roomId={roomId}
                role="Coder"
                isSpectator={isSpectator}
              />
            </Box>
          </Box>

          {/* Bottom Row: Console */}
          <Box
            style={{
              flex: "1 1 35%",
              backgroundColor: "#1e1e1e",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <Box p="xs" style={{ borderBottom: "1px solid #444" }}>
              <Tabs
                value={activeTab}
                onChange={setActiveTab}
                variant="outline"
                color="gray"
              >
                <Tabs.List>
                  <Tabs.Tab value="console" style={{ color: "white" }}>
                    Console Output
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs>
            </Box>
            <Box style={{ flex: 1 }}>
              <Editor
                height="100%"
                theme="vs-dark"
                defaultLanguage="javascript"
                options={{ readOnly: true, minimap: { enabled: false } }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}