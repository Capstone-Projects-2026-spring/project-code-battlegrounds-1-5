import { Role } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import { getPrisma } from '../prisma';
import { deleteVm } from '../utils/vm/deleteVm';

export function startExpirationListener(io: Server, pubClient: Redis): void {
  const sub = pubClient.duplicate();

  sub.subscribe('__keyevent@0__:expired', (error) => {
    if (error) {
      console.error('Failed to subscribe to expiration events', error);
    }
  });

  sub.on('message', async (channel, expiredKey) => {
    try {
      if (!expiredKey.startsWith('game:')) {
        return;
      }

      const gameId = expiredKey.split(':')[1];
      if (!gameId) {
        return;
      }

      if (expiredKey.endsWith(':roleswap:warning')) {
        console.log(`Game ${gameId} roleswap warning`);
        io.to(gameId).emit('roleSwapWarning');
        return;
      }

      if (expiredKey.endsWith(':roleswap')) {
        console.log(`Game ${gameId} roleswap`);
        io.to(gameId).emit('roleSwapping');

        // Distributed lock to ensure only one instance handles this event.
        const lockKey = `lock:game:${gameId}:roleswap`;
        const acquired = await pubClient.set(lockKey, '1', 'PX', 5000, 'NX');
        if (acquired !== 'OK') {
          return;
        }

        const gameActive = await pubClient.sismember('activeGames', gameId);
        if (gameActive !== 1) {
          return;
        }

        const teams = await getPrisma().team.findMany({
          where: { gameRoomId: gameId },
          select: { id: true },
        });

        const teamIds = teams.map((team) => team.id);
        if (teamIds.length === 0) {
          return;
        }

        setTimeout(() => {
          void (async (): Promise<void> => {
            await getPrisma().teamPlayer.updateMany({
              where: { teamId: { in: teamIds }, role: Role.CODER },
              data: { role: Role.SPECTATOR },
            });
            await getPrisma().teamPlayer.updateMany({
              where: { teamId: { in: teamIds }, role: Role.TESTER },
              data: { role: Role.CODER },
            });
            await getPrisma().teamPlayer.updateMany({
              where: { teamId: { in: teamIds }, role: Role.SPECTATOR },
              data: { role: Role.TESTER },
            });

            for (const teamId of teamIds) {
              io.to(teamId).emit('roleSwap');
            }
          })().catch((error: unknown) => {
            console.error('Failed to process role swap event', error);
          });
        }, 2500);

        return;
      }

      if (expiredKey.endsWith(':expires')) {
        console.log(`Game ${gameId} expired`);

        // Distributed lock to ensure only one instance handles this event.
        const lockKey = `lock:game:${gameId}:end`;
        const acquired = await pubClient.set(lockKey, '1', 'PX', 5000, 'NX');
        if (acquired !== 'OK') {
          return;
        }

        const gameActive = await pubClient.sismember('activeGames', gameId);
        if (gameActive !== 1) {
          return;
        }

        await getPrisma().gameRoom.update({
          where: { id: gameId },
          data: { status: 'FINISHED' },
        });

        await pubClient.srem('activeGames', gameId);
        void deleteVm(gameId);
        io.to(gameId).emit('gameEnded');
      }
    } catch (error) {
      console.error('Error while handling key expiration event', { channel, expiredKey, error });
    }
  });
}