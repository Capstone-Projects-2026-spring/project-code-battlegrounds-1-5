import { useEffect, useState } from "react";
import { Box } from "@mantine/core";
import Navbar from "@/components/Navbar";
import ProblemBox from "@/components/ProblemBox";
import Editor from "@monaco-editor/react";
import ChatBox from "@/components/ChatBox";
import TesterDashboard from "@/components/TesterDashboard";
import GameTimer from "./GameTimer";
import { Socket } from "socket.io-client";
import { GameStatus } from "@prisma/client";

interface TesterPOVProps {
  socket: Socket;
  roomId: string;
  timeRemaining: number;
  duration: number;
  gameState: GameStatus;
  isSpectator?: boolean;
}

export default function TesterPOV({ socket, roomId, timeRemaining, duration, gameState, isSpectator = false }: TesterPOVProps) {
  const [liveCode, setLiveCode] = useState("// Waiting for coder to type...");

  useEffect(() => {
    const handler = (newCode: string) => {
      console.log("Tester received:", newCode);
      setLiveCode(newCode);
    };
    socket.on("receiveCodeUpdate", handler);
    return () => {
      socket.off("receiveCodeUpdate", handler);
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
        {gameState === GameStatus.ACTIVE && (
          <GameTimer _timeRemaining={timeRemaining} duration={duration} />
        )}
        <ProblemBox />
      </Box>

      <Box style={{ gridArea: "edit" }}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={liveCode}
          options={{
            readOnly: true,
            domReadOnly: true,
            cursorBlinking: "solid"
          }}
        />
      </Box>

      <Box style={{ gridArea: "testerDashBoard" }}>
        <TesterDashboard isSpectator={isSpectator} />
      </Box>

      <Box style={{ gridArea: "chatbox" }}>
        <ChatBox socket={socket} roomId={roomId} role="Quality" isSpectator={isSpectator} />
      </Box>
    </Box>
  );
}