/* eslint-disable @typescript-eslint/no-require-imports */
// Timer loop logic to check for game expiration and notify clients

function startGameTimer(io, gameService) {
    // check every second
    const interval = setInterval(async () => {
        try {
            const activeGames = await gameService.getActiveGames();
            for (const gameId of activeGames) {
                const { startedAt, duration } = await gameService.getGameTimes(gameId);
                if (startedAt && duration && Date.now() >= startedAt + duration) {
                    io.to(gameId).emit('gameEnded');
                    await gameService.cleanupGame(gameId);
                }
            }
        } catch (err) {
            console.error('Game timer error:', err);
        }
    }, 1000);

    return () => clearInterval(interval);
}

module.exports = { startGameTimer };
