// The game service handlers itself. note that this is the only file that should interact with redis
// ^ GET A LOAD OF THIS HAHAHAHAHA

const GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

function createGameService(stateRedis) {
  return {
    GAME_DURATION_MS,

    async registerSocketToUser(userId, socketId) {
      await stateRedis.set(`socket:${userId}`, socketId) // link userId
    },

    async startGameIfNeeded(gameId) {
      const key = `game:${gameId}:expires`;
      // try to set key only if it doesnt exist (to avoid potential race condition)
      const started = await stateRedis.set(key, '1', 'PX', GAME_DURATION_MS, 'NX');
      if (started) {
        await stateRedis.sadd('activeGames', gameId);
        console.log(
          `Game ${gameId} started with duration ${GAME_DURATION_MS / 1000} seconds`
        );
      }

      const ttl = await stateRedis.pttl(key);

      return {
        duration: GAME_DURATION_MS,
        remaining: ttl,
      };
    },

    async isGameStarted(gameId) {
      const key = `game:${gameId}:expires`;
      const exists = await stateRedis.exists(key);
      return exists === 1;
    },

    async getLatestCode(teamId) {
      return stateRedis.get(`game:${teamId}:code`);
    },

    async saveLatestCode(teamId, code) {
      return stateRedis.set(`game:${teamId}:code`, code);
    },

    async getActiveGames() {
      return stateRedis.smembers('activeGames');
    },

    async getGameTime(gameId) {
      const ttl = await stateRedis.pttl(`game:${gameId}:expires`)
      return { ttl };
    },

    async cleanupGame(gameId, userId) {
      await stateRedis.srem('activeGames', gameId);
      await stateRedis.del(`socket:${userId}`)
      // TODO: remove expiration key if not expired yet.
      // potential future cleanup: code, submissions, etc.
    },
  };
}

module.exports = { createGameService, GAME_DURATION_MS };
