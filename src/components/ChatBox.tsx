import { useState, useEffect } from 'react';
import { ScrollArea, TextInput, ActionIcon, Paper, Text, Stack, Box } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { Socket } from 'socket.io-client';

interface Message {
  id: string;
  text: string;
  user: string; 
}

interface ChatBoxProps {
  socket: Socket;
  roomId: string;
  role: string;
}

export default function ChatBox({ socket, roomId, role }: ChatBoxProps) {

  // State for the entire chat history
  const [messages, setMessages] = useState<Message[]>([]);
  
  // State for the text currently being typed in the input box
  const [currentText, setCurrentText] = useState('');

  // 3. Listen for INCOMING messages from the server
  useEffect(() => {
    socket.on('receiveChat', (incomingMessage: Message) => {
      // The "prev" callback ensures we always append to the most recent array
      setMessages((prev) => [...prev, incomingMessage]);
    });

    return () => {
      socket.off('receiveChat');
    };
  }, [socket]);

  const handleSendMessage = () => {
    if (currentText.trim() === '') return;

    // Create the message object
    const newMessage: Message = {
      id: Math.random().toString(36).substring(7), // Quick random ID
      text: currentText,
      user: role, 
    };

    // Optimistically add it to our own screen instantly
    setMessages((prev) => [...prev, newMessage]);

    // Send it to the server to broadcast to the other person
    socket.emit('sendChat', { roomId, message: newMessage });

    // Clear the input box
    setCurrentText('');
  };

  return (
    <Paper shadow="xs" p="md" withBorder h="100%" display="flex" style={{ flexDirection: 'column' }}>
      <Text fw={700} mb="xs">Match Chat</Text>
      
      <ScrollArea style={{ flex: 1 }} mb="md">
        <Stack gap="xs">
          {messages.map((msg) => (
            <Box key={msg.id}>
              <Text size="xs" c="dimmed" fw={500} tt="capitalize">
                {msg.user}
              </Text>
              <Paper withBorder p="xs" radius="sm" bg="var(--mantine-color-gray-0)">
                <Text size="sm">{msg.text}</Text>
              </Paper>
            </Box>
          ))}
        </Stack>
      </ScrollArea>

      <TextInput
        placeholder="Type a message..."
        value={currentText}
        onChange={(event) => setCurrentText(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleSendMessage(); // Allow sending with Enter key
        }}
        rightSection={
          <ActionIcon variant="filled" color="blue" radius="xl" onClick={handleSendMessage}>
            <IconSend size={16} />
          </ActionIcon>
        }
      />
    </Paper>
  );
}