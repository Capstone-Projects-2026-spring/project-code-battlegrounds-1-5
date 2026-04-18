import { ActionIcon, Box, Tooltip } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { GameStatus } from "@prisma/client";
import { Panel } from "react-resizable-panels";

import ProblemBox from "@/components/ProblemBox";
import { useGameRoom } from "@/contexts/GameRoomContext";
import GameTimer from "@/components/GameTimer";

export default function ProblemSidebar() {
  const {
    gameState,
    endTime,
    isProblemVisible,
    problem,
    toggleProblemVisibility,
    handleTimerExpire,
  } = useGameRoom();

  return (
    <Panel
      defaultSize={isProblemVisible ? 300 : 70}
      minSize={isProblemVisible ? 15 : 70}
      maxSize={isProblemVisible ? undefined : 70}
      collapsible={false}
    >
      <Box
        style={{
          height: "100%",
          backgroundColor: "#333",
          color: "white",
          padding: "0",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: isProblemVisible ? "flex-start" : "center",
        }}
      >
        {(gameState === GameStatus.ACTIVE || gameState === GameStatus.FLIPPING) && (
          <Box mb="md" p="1rem" pb={isProblemVisible ? "md" : "1rem"}>
            <GameTimer endTime={endTime} onExpire={handleTimerExpire} />
          </Box>
        )}

        {isProblemVisible ? (
          <Box
            style={{
              width: "100%",
              flex: 1,
              minHeight: 0,
              padding: "0 1rem 1rem 1rem",
            }}
          >
            <ProblemBox
              problem={problem}
              onToggleVisibility={toggleProblemVisibility}
            />
          </Box>
        ) : (
          <Tooltip label="Show Problem">
            <ActionIcon
              variant="transparent"
              color="gray"
              size="xl"
              onClick={toggleProblemVisibility}
              title="Show Problem"
            >
              <IconEye size={24} />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>
    </Panel>
  );
}
