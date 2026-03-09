import React, { useState } from "react";
import { Box, Group, Button, Select, Text, Tabs } from "@mantine/core";
import Editor from "@monaco-editor/react";
import Navbar from "@/components/Navbar";
import ProblemBox from "@/components/ProblemBox";
import ChatBox from "@/components/ChatBox";
import { Socket } from "socket.io-client";

interface CoderPOVProps {
  socket: Socket;
  roomId: string;
}

export default function CoderPOV({ socket, roomId }: CoderPOVProps) {
  
  // active tabber
  const [activeTab, setActiveTab] = useState<string | null>("console");

  // send code updates to Tester in real-time
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      console.log("Coder is sending:", value);
      socket.emit("codeChange", { roomId, code: value });
    }
  };

  return (
    <Box h="100vh" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* 1. Header */}
      <Navbar
        links={["Timer", "Players", "Tournament"]}
        title="CODE BATTLEGROUNDS | GAMEMODE: TIMER"
      />

      <Box style={{ flex: 1, display: "flex" }}>
        {/* 2. Left Sidebar: Problem Description */}
        <Box w={300} bg="#333" c="white" p="md" style={{ overflowY: "auto" }}>
          <ProblemBox />
        </Box>

        {/* 3. Main Workspace */}
        <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          
          {/* Top Row: Dropdown, Run, Submit */}
          <Group p="xs" bg="#f8f9fa" style={{ borderBottom: "1px solid #ddd" }}>
            <Select
              size="xs"
              placeholder="Coding Language"
              data={["Javascript"]}
              defaultValue="Javascript"
            />
            <Text size="xs" c="dimmed">|</Text>
            <Button size="xs" color="cyan" variant="filled">RUN ▷</Button>
            <Text size="xs" c="dimmed">|</Text>
            <Button size="xs" variant="filled" color="green">Submit Final Code</Button>
          </Group>

          {/* Code Editor */}
          <Box style={{ display: "flex", height: "60%", borderBottom: "2px solid #333" }}>
            <Box style={{ flex: 2, borderRight: "1px solid #ddd" }}>
              <Editor
                height="100%"
                theme="vs-dark" 
                defaultLanguage="javascript"
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                }}
              />
            </Box>

            {/* Chat Box */}
            <Box style={{ flex: 1 }}>
              <ChatBox socket={socket} roomId={roomId} role="Coder" />
            </Box>
          </Box>

          {/* Console Output Panel */}
          <Box style={{ height: "40%", backgroundColor: "#1e1e1e", display: "flex", flexDirection: "column" }}>
            <Box p="xs" style={{ borderBottom: "1px solid #444" }}>
              <Group justify="space-between">
                <Tabs value={activeTab} onChange={setActiveTab} variant="outline" color="gray">
                  <Tabs.List>
                    <Tabs.Tab value="console" style={{ color: "white" }}>
                      Console Output
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs>
                <Group gap="xs">
                  <Button size="compact-xs" variant="outline" color="gray">Clear Console</Button>
                </Group>
              </Group>
            </Box>

            {/* Tester Result Box*/}
            <Box style={{ flex: 1 }}>
              <Editor
                height="100%"
                theme="vs-dark"
                defaultLanguage="javascript"
                defaultValue="// Code execution output will appear here..."
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  padding: { top: 10 }
                }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}