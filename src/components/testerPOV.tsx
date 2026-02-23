import React, { useEffect, useState } from "react";
import { Box } from "@mantine/core";
import Navbar from "@/components/Navbar";
import ProblemBox from "@/components/ProblemBox";
import BroadStats from "@/components/Broadstats";
import Editor from "@monaco-editor/react";
import ChatBox from "@/components/ChatBox";
import TesterDashboard from "@/components/TesterDashboard"; 

// We will bring in the new TesterDashboard here
import { Socket } from "socket.io-client";

interface TesterPOVProps {
  socket: Socket;
  roomId: string; 
}

export default function TesterPOV({ socket, roomId }: TesterPOVProps) {
  // State to hold the incoming keystrokes
  const [liveCode, setLiveCode] = useState("// Waiting for coder to type...");

  useEffect(() => {
    socket.on("receiveCodeUpdate", (newCode: string) => {
      console.log("Tester received:", newCode); // <-- ADD THIS
      setLiveCode(newCode);
    });

    return () => {
      socket.off("receiveCodeUpdate");
    };
  }, [socket]);

  return (
    <Box
      style={{
        display: "grid",
        height: "100vh",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridTemplateRows: "auto 1fr 1fr auto", 
        gridTemplateAreas: `
          "nav nav nav nav"
          "prob edit edit testerDashBoard"
          "prob edit edit chatbox"
          "foot foot foot foot"
        `,
      }}
    >
      <Box style={{ gridArea: "nav" }}>
        <Navbar
          links={["Time", "Players", "Tournament"]}
          title="Code BattleGrounds"
        />
      </Box>

      <Box style={{ gridArea: "prob", borderRight: "1px solid #e0e0e0" }}>
        <ProblemBox />
      </Box>

      <Box style={{ gridArea: "edit" }}>
        {/* 3. The Monaco Editor is locked and driven entirely by WebSocket data */}
        <Editor 
          height="100%" 
          defaultLanguage="javascript" 
          theme="vs-dark" 
          value={liveCode}
          options={{ 
            readOnly: true, // Locks the editor
            domReadOnly: true,
            cursorBlinking: "solid" // Minor tweak to show it's observing, not active
          }} 
        />
      </Box>

      <Box style={{ gridArea: "testerDashBoard" }}>
            <TesterDashboard />
      </Box>

      <Box style={{ gridArea: "chatbox" }}>
            <ChatBox socket={socket} roomId={roomId} role="Tester" />
      </Box>
      
      <Box style={{ gridArea: "foot" }}>
        <BroadStats />
      </Box>
    </Box>
  );
}