import type { Redis } from 'ioredis';
import type { ChatMessage, TestableCase } from '../types';

export const GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const SECONDS_BEFORE_ROLE_SWAP_WARNING = 60 * 1000; // 60 seconds in milliseconds

interface GameStartTime {
  duration: number;
  remaining: number;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function createGameService(stateRedis: Redis) {
  return {
    GAME_DURATION_MS,

    async registerSocketToUser(userId: string, socketId: string): Promise<void> {
      await stateRedis.set(`socket:${userId}`, socketId);
      console.log(`registered: ${userId}`);
    },

    async startGameIfNeeded(gameId: string): Promise<GameStartTime> {
      const key = `game:${gameId}:expires`;

      // Try to set key only if it does not exist (to avoid race conditions).
      const started = await stateRedis.set(key, '1', 'PX', GAME_DURATION_MS, 'NX');
      if (started) {
        const flipRatio = Math.random() * (0.7 - 0.3) + 0.3;
        const flippedDuration = Math.floor(GAME_DURATION_MS * flipRatio);
        const flippedKey = `game:${gameId}:roleswap`;
        const warningKey = `game:${gameId}:roleswap:warning`;

        console.log('Flipped key being set');
        await stateRedis.set(flippedKey, '1', 'PX', flippedDuration, 'NX');

        const warningTrigger = Math.max(0, flippedDuration - SECONDS_BEFORE_ROLE_SWAP_WARNING);
        console.log('Warning key being set');
        await stateRedis.set(warningKey, '1', 'PX', warningTrigger, 'NX');

        await stateRedis.sadd('activeGames', gameId);
        console.log(`Game ${gameId} started with duration ${GAME_DURATION_MS / 1000} seconds`);
      }

      const ttl = await stateRedis.pttl(key);
      return {
        duration: GAME_DURATION_MS,
        remaining: ttl,
      };
    },

    async isGameStarted(gameId: string): Promise<boolean> {
      const key = `game:${gameId}:expires`;
      const exists = await stateRedis.exists(key);
      return exists === 1;
    },

    async getLatestCode(teamId: string): Promise<string | null> {
      return stateRedis.get(`game:${teamId}:code`);
    },

    async saveLatestCode(teamId: string, code: string): Promise<'OK' | null> {
      return stateRedis.set(`game:${teamId}:code`, code);
    },

    async getChatMessages(teamId: string): Promise<ChatMessage[]> {
      const messages = await stateRedis.lrange(`chat:${teamId}`, 0, -1);
      return messages.flatMap((message) => {
        try {
          return [parseJson<ChatMessage>(message)];
        } catch (error: unknown) {
          console.error('Failed to parse chat message from Redis', error);
          return [];
        }
      });
    },

    async saveChatMessage(teamId: string, message: ChatMessage): Promise<void> {
      await stateRedis.rpush(`chat:${teamId}`, JSON.stringify(message));
      await stateRedis.ltrim(`chat:${teamId}`, -50, -1); // keep latest 50 messages
    },

    async saveTestCases(teamId: string, testCases: TestableCase[]): Promise<void> {
      await stateRedis.set(`testcases:${teamId}`, JSON.stringify(testCases));
    },

    async getTestCases(teamId: string): Promise<TestableCase[] | null> {
      const data = await stateRedis.get(`testcases:${teamId}`);
      return data ? parseJson<TestableCase[]>(data) : null;
    },

    async getActiveGames(): Promise<string[]> {
      return stateRedis.smembers('activeGames');
    },

    async getGameTime(gameId: string): Promise<{ ttl: number }> {
      const ttl = await stateRedis.pttl(`game:${gameId}:expires`);
      return { ttl };
    },

    async getRoleSwapTime(gameId: string): Promise<number | null> {
      const ttl = await stateRedis.pttl(`game:${gameId}:roleswap`);
      return ttl > 0 ? ttl : null;
    },

    // Deletes all Redis timer keys for a game so expiration events stop firing
    // after the game ends early (for example, after submitCode).
    async cleanupGameTimers(gameId: string): Promise<void> {
      await stateRedis.del(`game:${gameId}:expires`);
      await stateRedis.del(`game:${gameId}:roleswap`);
      await stateRedis.del(`game:${gameId}:roleswap:warning`);
      await stateRedis.srem('activeGames', gameId);
      console.log(`Cleaned up Redis timers for game ${gameId}`);
    },

    async cleanupSocket(userId: string): Promise<void> {
      await stateRedis.del(`socket:${userId}`);
    },

    async getSocketId(userId: string): Promise<string | null> {
      return stateRedis.get(`socket:${userId}`);
    },

    async saveGameData(key: string, value: string): Promise<'OK' | null> {
      return stateRedis.set(key, value);
    },

    async getGameData<T>(key: string): Promise<T | null> {
      const data = await stateRedis.get(key);
      return data ? parseJson<T>(data) : null;
    },

    async deleteGameData(key: string): Promise<number> {
      return stateRedis.del(key);
    },
  };
}

export type GameService = ReturnType<typeof createGameService>;