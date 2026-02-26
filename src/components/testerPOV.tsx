import React, { useEffect, useState } from "react";
import { Box, Group, Button, Select, Text, Tabs } from "@mantine/core";
import Editor from "@monaco-editor/react";
import Navbar from "@/components/Navbar";
import ProblemBox from "@/components/ProblemBox";
import ChatBox from "@/components/ChatBox";
import BroadStats from "@/components/Broadstats";
import TesterDashboard from "@/components/TesterDashboard";
import { Socket } from "socket.io-client";

interface TesterPOVProps {
  socket: Socket;
  roomId: string;
  isSpectator?: boolean;
}

export default function TesterPOV({ socket, roomId, isSpectator }: TesterPOVProps) {
  const [liveCode, setLiveCode] = useState("// Waiting for coder to type...");
  const [testCases, setTestCases] = useState([{ id: "1", content: "// Write Test 1 here..." }]);
  const [activeTab, setActiveTab] = useState<string | null>("1");

  useEffect(() => {
    const handler = (newCode: string) => setLiveCode(newCode);
    socket.on("receiveCodeUpdate", handler);
    return () => socket.off("receiveCodeUpdate", handler);
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

      <Box style={{ flex: 1, display: "flex" }}>
        <Box w={300} bg="#333" c="white" p="md" style={{ overflowY: "auto" }}>
          <ProblemBox />
        </Box>

                    {/* Main Workspace */}
                    <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      {/* Top Row: Dropdown, Run, Submit (and Tester Dashboard area) */}
                      <Group p="xs" bg="#f8f9fa" style={{ borderBottom: "1px solid #ddd" }}>
                        <Select
                          size="xs"
                          placeholder="Coding Language"
                          data={["Javascript"]}
                          defaultValue="Javascript"
                          disabled
                        />
                        <Text size="xs" c="dimmed">|</Text>
                        <Button size="xs" color="cyan" variant="filled">RUN ▷</Button>
                        <Text size="xs" c="dimmed">|</Text>
                        <Button size="xs" variant="subtle" color="gray">Submit</Button>
                        <Box style={{ marginLeft: 'auto' }}>
                          <TesterDashboard />
                        </Box>
                      </Group>

                      {/* Middle Row: Code Watcher & Chat Box */}
                      <Box style={{ display: "flex", height: "45%", borderBottom: "2px solid #333" }}>
                        <Box style={{ flex: 2, borderRight: "1px solid #ddd" }}>
                          <Editor
                            height="100%"
                            theme="vs-light"
                            language="javascript"
                            value={liveCode}
                            options={{
                              readOnly: true,
                              domReadOnly: true,
                              minimap: { enabled: false }
                            }}
                          />
                        </Box>
                        <Box style={{ flex: 1 }}>
                          <ChatBox socket={socket} roomId={roomId} role="Quality" isSpectator={isSpectator} />
                        </Box>
                      </Box>

                      {/* Bottom Row: Testing Board / Terminal */}
                      <Box style={{ flex: 1, backgroundColor: "#1e1e1e", display: "flex", flexDirection: "column" }}>
                        <Box p="xs" style={{ borderBottom: "1px solid #444" }}>
                          <Group justify="space-between">
                            <Tabs value={activeTab} onChange={setActiveTab} variant="outline" color="gray">
                              <Tabs.List>
                                {testCases.map((test) => (
                                  <Tabs.Tab key={test.id} value={test.id} style={{ color: "white" }}>
                                    Test {test.id}
                                  </Tabs.Tab>
                                ))}
                                {testCases.length < 5 && (
                                  <Button variant="subtle" size="xs" color="gray" onClick={addNewTest}>
                                    +
                                  </Button>
                                )}
                              </Tabs.List>
                            </Tabs>

                <Group gap="xs">
                  <Button size="xs" variant="outline" color="gray">Debug</Button>
                  <Button size="xs" variant="filled" color="blue">Run Test</Button>
                  <Button size="xs" variant="filled" color="green">Submit</Button>
                </Group>
              </Group>
            </Box>

                        {/* Terminal Editor Area */}
                        <Box style={{ flex: 1 }}>
                          <Editor
                            height="100%"
                            theme="vs-dark"
                            defaultLanguage="javascript"
                            defaultValue="// Write your custom test cases or debug reports here..."
                            options={{
                              minimap: { enabled: false },
                              fontSize: 13,
                              padding: { top: 10 }
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    {/* Right Sidebar: additional dashboard or metrics */}
                    <Box w={300} p="md" style={{ borderLeft: '1px solid #ddd', overflowY: 'auto' }}>
                      <TesterDashboard />
                    </Box>
                  </Box>

                  {/* Footer: Broad stats */}
                  <Box style={{ height: 64 }}>
                    <BroadStats />
                  </Box>
                </Box>
              );
            }