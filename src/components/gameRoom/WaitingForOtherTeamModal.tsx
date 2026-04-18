import { Center, Loader, Modal, Stack, Text } from "@mantine/core";

import { useGameRoom } from "@/contexts/GameRoomContext";

export default function WaitingForOtherTeamModal() {
  const { isWaitingForOtherTeam } = useGameRoom();

  return (
    <Modal
      opened={isWaitingForOtherTeam}
      onClose={() => {}}
      centered
      withCloseButton={false}
      closeOnEscape={false}
      closeOnClickOutside={false}
    >
      <Center>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="lg" fw={500}>
            Waiting for other team to submit...
          </Text>
        </Stack>
      </Center>
    </Modal>
  );
}
