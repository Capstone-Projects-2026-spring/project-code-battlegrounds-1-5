import { GameType, ProblemDifficulty } from '@prisma/client';
import type { Server } from 'socket.io';
import { z } from 'zod';
import type { GameService } from '../../game/gameService';
import type { MatchmakingService } from '../../matchmaking/matchmakingService';
import type { SocketWithState } from '../../types';
import { validate } from '../../utils/validate';

const queueStatusSchema = z.enum(['idle', 'queued', 'matched', 'error']);

const joinQueueSchema = z.object({
  userId: z.string(),
  gameType: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER]),
  difficulty: z.enum([ProblemDifficulty.EASY, ProblemDifficulty.MEDIUM, ProblemDifficulty.HARD]),
  partyId: z.string().nullable().optional(),
  lobbyId: z.string().nullable().optional(),
});

const leaveQueueSchema = z.object({
  gameType: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER]),
  difficulty: z.enum([ProblemDifficulty.EASY, ProblemDifficulty.MEDIUM, ProblemDifficulty.HARD]),
});

const updateQueueSelectionSchema = z.object({
  gameType: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER]),
  difficulty: z.enum([ProblemDifficulty.EASY, ProblemDifficulty.MEDIUM, ProblemDifficulty.HARD]),
  partyMember: z.object({ userId: z.string() }),
});

const partySearchSchema = z.object({
  partyMember: z.object({ userId: z.string() }).nullable().optional(),
  state: queueStatusSchema,
});

export function registerMatchmakingHandlers(
  io: Server,
  socket: SocketWithState,
  matchmakingService: MatchmakingService,
  gameService: GameService
): void {
  socket.on('joinQueue', async (data) => {
    const payload = validate(joinQueueSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for joinQueue.' });
      return;
    }

    const result = await matchmakingService.joinQueue(
      payload.userId,
      payload.gameType,
      payload.difficulty,
      payload.partyId ?? payload.lobbyId ?? null
    );
    socket.emit('queueStatus', result);
  });

  socket.on('leaveQueue', async (data) => {
    const payload = validate(leaveQueueSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for leaveQueue.' });
      return;
    }

    if (!socket.userId) {
      return;
    }

    const result = await matchmakingService.leaveQueue(
      socket.userId,
      payload.gameType,
      payload.difficulty
    );
    socket.emit('queueStatus', result);
  });

  socket.on('updateQueueSelection', async (data) => {
    const payload = validate(updateQueueSelectionSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for updateQueueSelection.' });
      return;
    }

    if (!socket.userId) {
      return;
    }

    const partyMemberSocket = await gameService.getSocketId(payload.partyMember.userId);
    if (partyMemberSocket) {
      io.to(partyMemberSocket).emit('receiveQueueSelection', {
        gameType: payload.gameType,
        difficulty: payload.difficulty,
      });
    }
  });

  socket.on('partySearch', async (data) => {
    const payload = validate(partySearchSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for partySearch.' });
      return;
    }

    if (!socket.userId || !payload.partyMember) {
      return;
    }

    const partyMemberSocket = await gameService.getSocketId(payload.partyMember.userId);
    if (partyMemberSocket) {
      io.to(partyMemberSocket).emit('partySearchUpdate', { state: payload.state });
    }
  });
}