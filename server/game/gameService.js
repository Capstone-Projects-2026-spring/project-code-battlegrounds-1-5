// Game service encapsulates Redis game state logic

const GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

function createGameService(stateRedis) {
  return {
    GAME_DURATION_MS,

    async ensureGameStarted(gameId) {
      let startedAt = await stateRedis.get(`game:${gameId}:startedAt`);
      if (!startedAt) {
        startedAt = Date.now();
        await stateRedis.sadd('activeGames', gameId);
        await stateRedis.set(`game:${gameId}:startedAt`, startedAt);
        await stateRedis.set(`game:${gameId}:duration`, GAME_DURATION_MS);
        console.log(
          `Game ${gameId} started at ${new Date(Number(startedAt)).toISOString()} with duration ${GAME_DURATION_MS / 1000} seconds`
        );
      }
      return Number(startedAt);
    },

    async getLatestCode(gameId) {
      return stateRedis.get(`game:${gameId}:code`);
    },

    async saveLatestCode(gameId, code) {
      return stateRedis.set(`game:${gameId}:code`, code);
    },

    async getActiveGames() {
      return stateRedis.smembers('activeGames');
    },

    async getGameTimes(gameId) {
      const startedAt = Number(await stateRedis.get(`game:${gameId}:startedAt`));
      const duration = Number(await stateRedis.get(`game:${gameId}:duration`));
      return { startedAt, duration };
    },

    async cleanupGame(gameId) {
      await stateRedis.srem('activeGames', gameId);
      await stateRedis.del(`game:${gameId}:startedAt`);
      await stateRedis.del(`game:${gameId}:duration`);
      // potential future cleanup: code, submissions, etc.
    },
  };
}

module.exports = { createGameService, GAME_DURATION_MS };
