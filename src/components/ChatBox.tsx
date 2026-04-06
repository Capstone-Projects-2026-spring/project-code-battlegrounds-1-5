import { useState, useEffect } from 'react';
import { ScrollArea, TextInput, ActionIcon, Paper, Text, Stack, Box } from '@mantine/core';
import { IconSend2 } from '@tabler/icons-react';
import type { Socket } from 'socket.io-client';
import { usePostHog } from 'posthog-js/react';
import { Role } from '@prisma/client';

export interface Message {
  id: string;
  text: string;
  userName: string;
  timestamp: number;
}

interface ChatBoxProps {
  socket: Socket;
  roomId: string;
  userName: string;
  isSpectator?: boolean;
  role?: Role | null // for analytic purposes
}

export default function ChatBox({ socket, roomId, userName, isSpectator = false, role }: ChatBoxProps) {

  const posthog = usePostHog();
  const [messages, setMessages] = useState<Message[]>([]);

  // State for the text currently being typed in the input box
  const [currentText, setCurrentText] = useState('');

  // 3. Listen for INCOMING messages from the server
  useEffect(() => {
    socket.emit('requestChatSync', { teamId: roomId }); // Request chat history on mount

    socket.on('receiveChatHistory', (history: Message[]) => {
      setMessages(history);
    });

    socket.on('receiveChat', (incomingMessage: Message) => {
      // The "prev" callback ensures we always append to the most recent array
      setMessages((prev) => [...prev, incomingMessage]);
    });

    return () => {
      socket.off('receiveChat');
      socket.off('receiveChatHistory');
    };
  }, [socket, roomId]);

  const handleSendMessage = () => {
    if (isSpectator) return;
    if (currentText.trim() === '') return;

    // Create the message object
    const newMessage: Message = {
      id: Math.random().toString(36).substring(7), // Quick random ID
      text: currentText,
      userName,
      timestamp: Date.now(),
    };

    // Optimistically add it to our own screen instantly
    setMessages((prev) => [...prev, newMessage]);

    // Send it to the server to broadcast to the other person
    socket.emit('sendChat', { teamId: roomId, message: newMessage });

    posthog.capture("chat_message_sent", { 
      roomId, 
      message: newMessage, 
      isSpectator,
      role // helpful to know which role is sending more messages
    });

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
              <Text size="xs" fw={500} tt="capitalize">
                {msg.userName}
              </Text>
              <Paper withBorder p="xs" radius="sm">
                <Text size="sm">
                  {msg.text}
                </Text>
              </Paper>
            </Box>
          ))}
        </Stack>
      </ScrollArea>

      <TextInput
        disabled={isSpectator}
        placeholder="Type a message..."
        value={currentText}
        onChange={(event) => setCurrentText(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleSendMessage(); // Allow sending with Enter key
        }}
        rightSection={
          <ActionIcon
            variant="subtle"
            color="blue"
            onClick={handleSendMessage}
            disabled={isSpectator}
          >
            <IconSend2 size={16} />
          </ActionIcon>
        }
      />
    </Paper>
  );
}