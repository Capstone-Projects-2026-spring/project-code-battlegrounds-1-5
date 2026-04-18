import { Button, Group, Select } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { Role } from "@prisma/client";

import { useGameRoom } from "@/contexts/GameRoomContext";
import styles from "@/styles/GameRoom.module.css";

export default function EditorToolbar() {
  const {
    effectiveRole,
    isSpectator,
    role,
    isWaitingForOtherTeam,
    onRunCodeClick,
    submitFinalCode,
  } = useGameRoom();

  return (
    <Group p="xs">
      <Select
        size="xs"
        data={["Javascript"]}
        defaultValue="Javascript"
        disabled={isSpectator || role !== Role.CODER}
      />

      {effectiveRole === Role.CODER && (
        <>
          <Button
            size="xs"
            color="cyan"
            disabled={isSpectator || isWaitingForOtherTeam}
            className={styles.runButton}
            onClick={onRunCodeClick}
            rightSection={<IconPlayerPlay size="var(--mantine-font-size-md)" />}
          >
            RUN
          </Button>
          <Button
            size="xs"
            color="green"
            onClick={submitFinalCode}
            disabled={isSpectator || isWaitingForOtherTeam}
          >
            {isWaitingForOtherTeam
              ? "Waiting for other team..."
              : "Submit Final Code"}
          </Button>
        </>
      )}
    </Group>
  );
}
