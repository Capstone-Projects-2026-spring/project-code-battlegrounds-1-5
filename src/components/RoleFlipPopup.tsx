import { Modal, Text, Stack } from "@mantine/core";
import { GameStatus } from "@prisma/client";

interface RoleFlipPopupProps {
  gameState: GameStatus;
}

export default function RoleFlipPopup({ gameState }: RoleFlipPopupProps) {
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
        <Text size="sm" c="dimmed">Ooh, switching things up...</Text>
      </Stack>
    </Modal>
  );
}