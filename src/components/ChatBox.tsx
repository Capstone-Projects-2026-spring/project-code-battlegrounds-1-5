import { useState, useEffect, useRef } from 'react';
import { ScrollArea, TextInput, ActionIcon, Paper, Text, Stack, Box } from '@mantine/core';
import { IconSend2 } from '@tabler/icons-react';
import { usePostHog } from 'posthog-js/react';
import { useGameRoom } from '@/contexts/GameRoomContext';
import { useSocket } from '@/contexts/SocketContext';
import styles from '@/styles/comps/ChatBox.module.css';

export interface Message {
  id: string;
  text: string;
  userName: string;
  timestamp: number;
}

export default function ChatBox() {

  const posthog = usePostHog();
  const { socket } = useSocket();
  const { teamSelected, userName, isSpectator, role } = useGameRoom();
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // State for the text currently being typed in the input box
  const [currentText, setCurrentText] = useState('');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  // 3. Listen for INCOMING messages from the server
  useEffect(() => {
    if (!socket || !teamSelected) return;

    const handleReceiveChatHistory = (history: Message[]) => {
      setMessages(history);
    };

    const handleReceiveChat = (incomingMessage: Message) => {
      // The "prev" callback ensures we always append to the most recent array
      setMessages((prev) => [...prev, incomingMessage]);
    };

    socket.emit('requestChatSync', { teamId: teamSelected }); // Request chat history on mount
    socket.on('receiveChatHistory', handleReceiveChatHistory);
    socket.on('receiveChat', handleReceiveChat);

    return () => {
      socket.off('receiveChat', handleReceiveChat);
      socket.off('receiveChatHistory', handleReceiveChatHistory);
    };
  }, [socket, teamSelected]);

  const handleSendMessage = () => {
    if (!socket || !teamSelected) return;
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
    socket.emit('sendChat', { teamId: teamSelected, message: newMessage });

    posthog.capture("chat_message_sent", { 
      roomId: teamSelected,
      message: newMessage, 
      isSpectator,
      role // helpful to know which role is sending more messages
    });

    // Clear the input box
    setCurrentText('');
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Paper shadow="xs" p="md" withBorder h="100%" className={styles.chatContainer}>
      <Text mb="xs" className={styles.header}>Match Chat</Text>

      <ScrollArea className={styles.scrollArea} mb="md" ref={scrollAreaRef}>
        <Stack className={styles.messagesStack}>
          {messages.map((msg) => {
            const isOwnMessage = msg.userName === userName;
            return (
              <Box key={msg.id} className={`${styles.messageContainer} ${isOwnMessage ? styles.ownMessage : ''}`}>
                <Text className={styles.messageAuthor}>
                  {msg.userName}
                </Text>
                <Paper withBorder className={styles.messageBubble}>
                  <Text className={styles.messageText}>
                    {msg.text}
                  </Text>
                  <Text className={styles.timestamp}>
                    {formatTimestamp(msg.timestamp)}
                  </Text>
                </Paper>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>

      <Box className={styles.inputSection}>
        <TextInput
          disabled={isSpectator || !socket || !teamSelected}
          placeholder="Type a message..."
          value={currentText}
          onChange={(event) => setCurrentText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSendMessage(); // Allow sending with Enter key
          }}
          rightSection={
            <ActionIcon
              variant="subtle"
              color="console"
              onClick={handleSendMessage}
              disabled={isSpectator || !socket || !teamSelected}
              className={styles.sendButton}
            >
              <IconSend2 size={16} />
            </ActionIcon>
          }
        />
      </Box>
    </Paper>
  );
}