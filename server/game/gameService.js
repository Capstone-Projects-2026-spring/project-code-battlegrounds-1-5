// The game service handlers itself. note that this is the only file that should interact with redis

const GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

function createGameService(stateRedis) {
  return {
    GAME_DURATION_MS,

    async startGameIfNeeded(gameId) {
      const key = `game:${gameId}:expires`;
      const exists = await stateRedis.set(key);
      if (!exists) {
        // set an expiration key so we can get notified when the game is over
        await stateRedis.set(key, '1', 'PX', GAME_DURATION_MS)
        await stateRedis.sadd('activeGames', gameId);
        console.log(
          `Game ${gameId} started with duration ${GAME_DURATION_MS / 1000} seconds`
        );
      }

      const ttl = await stateRedis.pttl(key)

      return {
        duration: GAME_DURATION_MS,
        remaining: ttl,
      };

      /*let startedAt = await stateRedis.get(`game:${gameId}:startedAt`);
      if (!startedAt) {
        startedAt = Date.now();
        await stateRedis.sadd('activeGames', gameId);
        await stateRedis.set(`game:${gameId}:startedAt`, startedAt);
        await stateRedis.set(`game:${gameId}:duration`, GAME_DURATION_MS);
        console.log(
          `Game ${gameId} started at ${new Date(Number(startedAt)).toISOString()} with duration ${GAME_DURATION_MS / 1000} seconds`
        );
      }
      return Number(startedAt);*/
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

    async getGameTime(gameId) {
      const ttl = await stateRedis.pttl(`game:${gameId}:expires`)
      return { ttl };
    },

    async cleanupGame(gameId) {
      await stateRedis.srem('activeGames', gameId);
      // TODO: remove expiration key if not expired yet.
      // potential future cleanup: code, submissions, etc.
    },
  };
}

module.exports = { createGameService, GAME_DURATION_MS };
