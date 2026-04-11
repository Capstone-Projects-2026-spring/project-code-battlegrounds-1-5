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


    if (expiredKey.endsWith(':roleswap:warning')) {
      console.log(`Game ${gameId} roleswap warning`);
      io.to(gameId).emit('roleSwapWarning');
      return;
    }

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
        });
        await getPrisma().teamPlayer.updateMany({
          where: { teamId: { in: teamIds }, role: Role.TESTER },
          data: { role: Role.CODER }
        });
        await getPrisma().teamPlayer.updateMany({
          where: { teamId: { in: teamIds }, role: Role.SPECTATOR },
          data: { role: Role.TESTER }
        });
        io.to(teamIds[0]).emit('roleSwap');
        io.to(teamIds[1]).emit('roleSwap');
      }, 2500); // too fast it happens almost instantaneously on the frontend (so while work it out later)
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

      try {
        // Auto-save any code in Redis to the database before ending
        const teams = await getPrisma().team.findMany({
          where: { gameRoomId: gameId },
          select: { id: true },
          take: 2
        });

        const gameResult = await getPrisma().gameResult.findUnique({
          where: { gameRoomId: gameId },
          select: { team1Code: true, team2Code: true }
        });

        // Save team1 code if not already saved
        if (teams[0] && !gameResult?.team1Code) {
          const team1Code = await pubClient.get(`game:${teams[0].id}:code`);
          if (team1Code) {
            console.log(`Auto-saving team1 code on game expiration`);
            await getPrisma().gameResult.update({
              where: { gameRoomId: gameId },
              data: { team1Code }
            });
          }
        }

        // Save team2 code if not already saved (for 4-player games)
        if (teams[1] && !gameResult?.team2Code) {
          const team2Code = await pubClient.get(`game:${teams[1].id}:code`);
          if (team2Code) {
            console.log(`Auto-saving team2 code on game expiration`);
            await getPrisma().gameResult.update({
              where: { gameRoomId: gameId },
              data: { team2Code }
            });
          }
        }
      } catch (error) {
        console.error(`Error auto-saving code for game ${gameId} on expiration:`, error);
      }

      io.to(gameId).emit('gameEnded');
    }

  });
}

module.exports = { startExpirationListener };