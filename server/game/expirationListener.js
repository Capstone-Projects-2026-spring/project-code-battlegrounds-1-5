const { getPrisma } = require('../prisma/index');
const { Role } = require('@prisma/client');

function startExpirationListener(io, pubClient) {
  const sub = pubClient.duplicate();

  sub.subscribe('__keyevent@0__:expired', (err) => {
    if (err) {
      console.error('Failed to subscribe to expiration events', err);
    }
  });

  sub.on('message', async (channel, expiredKey) => {
    if (!expiredKey.startsWith('game:')) {
      return;
    }

    const gameId = expiredKey.split(':')[1];


    if (expiredKey.endsWith(':roleswap')) {
      console.log(`Game ${gameId} roleswap`);
      io.to(gameId).emit('roleSwapping');

      // distributed lock to ensure only ONE instance emits
      const lockKey = `lock:game:${gameId}:roleswap`;

      // hold lock for 5 seconds
      const acquired = await pubClient.set(
        lockKey,
        '1',
        'NX',
        'PX',
        5000
      );
      if (!acquired) return; // another instance already handling

      const gameActive = await pubClient.sismember('activeGames', gameId);
      if (!gameActive) return; // game already ended

      const teams = await getPrisma().team.findMany({
        where: { gameRoomId: gameId },
        select: { id: true }
      });

      const teamIds = teams.map(t => t.id);

      setTimeout(async () => {
        await getPrisma().teamPlayer.updateMany({
          where: { teamId: { in: teamIds }, role: Role.CODER },
          data: { role: Role.SPECTATOR }
        }),
        await getPrisma().teamPlayer.updateMany({
          where: { teamId: { in: teamIds }, role: Role.TESTER },
          data: { role: Role.CODER }
        }),
        await getPrisma().teamPlayer.updateMany({
          where: { teamId: { in: teamIds }, role: Role.SPECTATOR },
          data: { role: Role.TESTER }
        })
        io.to(teamIds[0]).emit('roleSwap', { teamId: teamIds[0] });
        io.to(teamIds[1]).emit('roleSwap', { teamId: teamIds[1] });
      }, 2500)
    }

    if (expiredKey.endsWith(':expires')) {
      console.log(`Game ${gameId} expired`);

      // distributed lock to ensure only ONE instance emits
      const lockKey = `lock:game:${gameId}:end`;

      // hold lock for 5 seconds
      const acquired = await pubClient.set(
        lockKey,
        '1',
        'NX',
        'PX',
        5000
      );

      if (!acquired) return; // another instance already handling

      io.to(gameId).emit('gameEnded');
    }

  });
}

module.exports = { startExpirationListener };