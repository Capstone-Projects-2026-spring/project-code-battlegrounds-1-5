import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createGameService } from '../game/gameService';
import { createInviteService } from '../invite/inviteService';
import { createMatchmakingService } from '../matchmaking/matchmakingService';
import type { RedisClients } from '../redis';
import { registerSocketHandlers } from './handlers';

export function initSocket(httpServer: HttpServer, redis: RedisClients): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.BETTER_AUTH_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Attach Redis adapter for cluster support.
  io.adapter(redis.adapter);

  // Create services using the shared Redis state client.
  const gameService = createGameService(redis.stateRedis);
  const matchmakingService = createMatchmakingService(redis.stateRedis, io);
  const inviteService = createInviteService(redis.stateRedis);

  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket, { gameService, matchmakingService, inviteService });
  });

  return io;
}
