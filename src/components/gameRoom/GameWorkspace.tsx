import { Box } from "@mantine/core";
import { Editor } from "@monaco-editor/react";
import { Role } from "@prisma/client";
import { useEffect } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";

import ChatBox from "@/components/ChatBox";
import RoleFlipPopup from "@/components/RoleFlipPopup";
import EditorToolbar from "@/components/gameRoom/EditorToolbar";
import ProblemSidebar from "@/components/gameRoom/ProblemSidebar";
import TesterPanel from "@/components/gameRoom/TesterPanel";
import { useGameState } from "@/contexts/GameStateContext";
import { useSocket } from "@/contexts/SocketContext";
import { useGameRoom } from "@/contexts/GameRoomContext";
import styles from "@/styles/GameRoom.module.css";

export const DEFAULT_STARTER_CODE = "function solution(a, b) { \n\treturn a + b;\n}";

export default function GameWorkspace() {
  const { code, setCode } = useGameState();
  const { socket } = useSocket();
  const {
    gameState,
    effectiveRole,
    isSpectator,
    role,
    isProblemVisible,
    teamSelected,
    userName,
  } = useGameRoom();

  const editorCode = code && code !== "// Waiting for code..." ? code : DEFAULT_STARTER_CODE;

  useEffect(() => {
    if (!socket || !teamSelected) return;
    socket.emit("requestCodeSync", { teamId: teamSelected });

    const handleCodeSync = (newCode: string) => {
      setCode(newCode);
    };
    socket.on("receiveCodeUpdate", handleCodeSync);

    return () => {
      socket.off("receiveCodeUpdate", handleCodeSync);
    };
  }, [socket, teamSelected, setCode]);

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || role !== Role.CODER || !socket || !teamSelected) {
      return;
    }

    socket.emit("codeChange", { teamId: teamSelected, code: value });
    setCode(value);
  };

  if (!socket || !teamSelected) return null;

  return (
    <Box
      data-testid={effectiveRole === Role.CODER ? "coder-pov" : "tester-pov"}
      h="100vh"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <RoleFlipPopup gameState={gameState} />

      <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <PanelGroup orientation="horizontal">
          <ProblemSidebar />

          {isProblemVisible && (
            <PanelResizeHandle className={styles.panelResizeHandleCol} />
          )}

          <Panel minSize={30}>
            <Box
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <EditorToolbar />

              <Box style={{ flex: 1, minHeight: 0 }}>
                <PanelGroup orientation="vertical">
                  <Panel defaultSize={55} minSize={25}>
                    <PanelGroup orientation="horizontal">
                      <Panel defaultSize={70} minSize={40}>
                        <Box style={{ height: "100%" }}>
                          <Editor
                            height="100%"
                            theme="vs-dark"
                            defaultLanguage="javascript"
                            value={editorCode}
                            onChange={!isSpectator ? handleEditorChange : undefined}
                            options={{
                              readOnly: isSpectator || role !== Role.CODER,
                              domReadOnly: isSpectator || role !== Role.CODER,
                              minimap: { enabled: false },
                            }}
                          />
                        </Box>
                      </Panel>

                      <PanelResizeHandle className={styles.panelResizeHandleCol} />

                      <Panel defaultSize={30} minSize={15}>
                        <Box style={{ height: "100%" }}>
                          <ChatBox
                            socket={socket}
                            roomId={teamSelected}
                            userName={userName}
                            isSpectator={isSpectator}
                            role={role}
                          />
                        </Box>
                      </Panel>
                    </PanelGroup>
                  </Panel>

                  <PanelResizeHandle className={styles.panelResizeHandleRow} />

                  {effectiveRole === Role.TESTER && <TesterPanel />}
                </PanelGroup>
              </Box>
            </Box>
          </Panel>
        </PanelGroup>
      </Box>
    </Box>
  );
}
