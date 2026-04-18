import { Center, Group, Loader, Text } from "@mantine/core";

export default function EnteringBattleground() {
  return (
    <Center h="100vh">
      <Group>
        <Loader color="blue" type="bars" />
        <Text size="xl" fw={500}>
          Entering BattleGround...
        </Text>
      </Group>
    </Center>
  );
}
