import { Modal, Text, Stack } from "@mantine/core";
import { GameStatus, Role } from "@prisma/client";

interface RoleFlipPopupProps {
  gameState: GameStatus;
  role: Role;
}

export default function RoleFlipPopup({ gameState, role }: RoleFlipPopupProps) {
  return (
    <Modal
      opened={gameState === GameStatus.FLIPPING}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      centered
      size="sm"
      overlayProps={{ blur: 3 }}
    >
      <Stack align="center" py="md" gap="xs">
        <Text size="xl" fw={600}>Roles flipping!</Text>
        <Text size="sm" c="dimmed">You are going to be {role === Role.CODER ? "Tester" : "Coder" }</Text>
      </Stack>
    </Modal>
  );
}