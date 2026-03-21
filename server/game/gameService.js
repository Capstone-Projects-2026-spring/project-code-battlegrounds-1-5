// The game service handlers itself. note that this is the only file that should interact with redis
// Redis can be accessed in the api layer for special cases now

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
        const flipRatio = Math.random() * (0.7 - 0.3) + 0.3; // random between 0.3 and 0.7
        const flipped_duration = Math.floor(GAME_DURATION_MS * flipRatio);
        const flippedKey = `game:${gameId}:roleswap`
        console.log("Flipped key being set");
        await stateRedis.set(flippedKey, '1', 'PX', flipped_duration, 'NX'); // set flip timer at the same time
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

    async getChatMessages(teamId) {
      const messages = await stateRedis.lrange(`chat:${teamId}`, 0, -1);
      return messages.map(m => JSON.parse(m));
    },

    async saveChatMessage(teamId, message) {
      await stateRedis.rpush(`chat:${teamId}`, JSON.stringify(message));
      await stateRedis.ltrim(`chat:${teamId}`, -50, -1); // Keep only latest 50 messages
    },

    async saveTestCases(teamId, testCases) {
      await stateRedis.set(`testcases:${teamId}`, JSON.stringify(testCases));
    },

    async getTestCases(teamId) {
      const data = await stateRedis.get(`testcases:${teamId}`);
      return data ? JSON.parse(data) : null;
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
