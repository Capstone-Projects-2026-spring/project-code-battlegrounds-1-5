import { Box, Button, Group } from "@mantine/core";

import { useGameRoom } from "@/contexts/GameRoomContext";
import { Role } from "@prisma/client";
import styles from "@/styles/GameRoom.module.css";

export default function SpectatorControls() {
  const {
    teams,
    onSelectSpectatorView,
    onExitSpectatorView,
  } = useGameRoom();

  return (
    <Box
      data-testid="spectating-box"
      style={{ position: "absolute", top: 12, left: 12, zIndex: 20 }}
    >
      {teams.map((team, i) => (
        <Group key={team.teamId} gap="xs">
          <Button
            data-testid={`team-${i + 1}-coder`}
            size="sm"
            onClick={() => onSelectSpectatorView(team.teamId, Role.CODER)}
          >
            Team {i + 1} Coder
          </Button>
          <Button
            data-testid={`team-${i + 1}-tester`}
            size="sm"
            onClick={() => onSelectSpectatorView(team.teamId, Role.TESTER)}
          >
            Team {i + 1} Tester
          </Button>
        </Group>
      ))}
      <Button
        className={styles.spectatorButton}
        data-testid="exit-spectator"
        size="sm"
        onClick={onExitSpectatorView}
      >
        Exit View
      </Button>
    </Box>
  );
}
