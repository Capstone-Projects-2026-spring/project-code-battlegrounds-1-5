import { useState } from 'react';
import { ScrollArea, TextInput, ActionIcon, Paper, Text, Stack, Box } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';

export default function ChatBox() {
  const [messages, setMessages] = useState([
    { id: 1, user: 'System', text: 'Welcome to the BattleGround!' },
  ]);

  return (
    <Paper shadow="xs" p="md" withBorder h="100%" display="flex" style={{ flexDirection: 'column' }}>
      <Text fw={700} mb="xs">Match Chat</Text>
      
      {/* 1. The Message Display Area */}
      <ScrollArea style={{ flex: 1 }} mb="md">
        <Stack gap="xs">
          {messages.map((msg) => (
            <Box key={msg.id}>
              <Text size="xs" c="dimmed" fw={500}>{msg.user}</Text>
              <Paper withBorder p="xs" radius="sm" bg="var(--mantine-color-gray-0)">
                <Text size="sm">{msg.text}</Text>
              </Paper>
            </Box>
          ))}
        </Stack>
      </ScrollArea>

      {/* 2. The Input Area */}
      <TextInput
        placeholder="Type a message..."
        rightSection={
          <ActionIcon variant="filled" color="blue" radius="xl">
            <IconSend size={16} />
          </ActionIcon>
        }
      />
    </Paper>
  );
}