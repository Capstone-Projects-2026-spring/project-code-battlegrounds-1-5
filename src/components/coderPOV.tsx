import React, { useEffect, useState } from "react";
import { Box } from "@mantine/core";
import Navbar from "@/components/Navbar";
import ProblemBox from "@/components/ProblemBox";
import BroadStats from "@/components/Broadstats";
import Editor from "@monaco-editor/react";
import ChatBox from "@/components/ChatBox";
import CoderDashboard from "@/components/CoderDashboard";
import { Socket } from "socket.io-client"; // <-- 1. Import Socket type

// 2. Define the props we are passing in from the dynamic page
interface CoderPOVProps {
  socket: Socket;
  roomId: string;
  isSpectator?: boolean;
}

export default function CoderPOV({ socket, roomId, isSpectator }: CoderPOVProps) {
  // If we're a spectator viewing the coder, we need to show live code
  // from the socket but prevent edits. When not a spectator, behave as normal.
  const [liveCode, setLiveCode] = useState<string>("// Waiting for code...");

  useEffect(() => {
    if (!isSpectator) return;

    const handler = (newCode: string) => {
      setLiveCode(newCode);
    };

    socket.on("receiveCodeUpdate", handler);

    return () => {
      socket.off("receiveCodeUpdate", handler);
    };
  }, [socket, isSpectator]);

  // 3. Create the handler that blasts keystrokes to the server
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      console.log("Coder is sending:", value); // <-- ADD THIS
      socket.emit("codeChange", { roomId, code: value });
    }
  };

  return (
    <Box
      style={{
        display: "grid",
        height: "100vh",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridTemplateRows: "auto 1fr 1fr auto", 
        gridTemplateAreas: `
          "nav nav nav nav"
          "prob edit edit coderDashBoard"
          "prob edit edit chatbox"
          "foot foot foot foot"
        `,
      }}
    >
      <Box style={{ gridArea: "nav" }}>
        <Navbar
          links={["Time", "Players", "Tournament"]}
          title="Code BattleGrounds"
          isSpectator={isSpectator}
        />
      </Box>

      <Box style={{ gridArea: "prob", borderRight: "1px solid #e0e0e0" }}>
        <ProblemBox />
      </Box>

      <Box style={{ gridArea: "edit" }}>
        {/* 4. Attach the handler to Monaco's onChange event */}
        {isSpectator ? (
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={liveCode}
            options={{ readOnly: true, domReadOnly: true }}
          />
        ) : (
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            onChange={handleEditorChange}
          />
        )}
      </Box>

      <Box style={{ gridArea: "coderDashBoard" }}>
            <CoderDashboard />
      </Box>

      <Box style={{ gridArea: "chatbox" }}>
        <ChatBox socket={socket} roomId={roomId} role="Coder" isSpectator={isSpectator} />
      </Box>
      
      <Box style={{ gridArea: "foot" }}>
        <BroadStats />
      </Box>
    </Box>
  );