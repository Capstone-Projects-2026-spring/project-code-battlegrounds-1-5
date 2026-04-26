import type { Server } from 'socket.io';
import type { GameService } from '../../game/gameService';
import type { InviteService } from '../../invite/inviteService';
import type { MatchmakingService } from '../../matchmaking/matchmakingService';
import type { SocketWithState } from '../../types';
import { registerExecutionHandlers } from './executionHandlers';
import { registerGameHandlers } from './gameHandlers';
import { registerInviteHandlers } from './inviteHandlers';
import { registerMatchmakingHandlers } from './matchmakingHandlers';

interface HandlerServices {
  gameService: GameService;
  matchmakingService: MatchmakingService;
  inviteService: InviteService;
}

export function registerSocketHandlers(
  io: Server,
  socket: SocketWithState,
  services: HandlerServices
): void {
  const { gameService, matchmakingService, inviteService } = services;

  registerGameHandlers(io, socket, gameService);
  registerExecutionHandlers(io, socket, gameService);
  registerMatchmakingHandlers(io, socket, matchmakingService, gameService);
  registerInviteHandlers(io, socket, inviteService, gameService);

  socket.on('disconnect', async () => {
    console.log(`Disconnected: ${socket.id}`);
    if (!socket.userId) {
      return;
    }

    try {
      await gameService.cleanupSocket(socket.userId);
    } catch (error: unknown) {
      console.error('Error during socket cleanup on disconnect', error);
    }

    await matchmakingService.leaveAllQueues(socket.userId);
  });
}