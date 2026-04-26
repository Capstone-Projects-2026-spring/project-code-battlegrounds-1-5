// The game service handlers itself. note that this is the only file that should interact with redis

const GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const SECONDS_BEFORE_ROLE_SWAP_WARNING = 60 * 1000; // 60 seconds in milliseconds


function createGameService(stateRedis, io) {
  return {
    GAME_DURATION_MS,

    async registerSocketToUser(userId, socketId) {
      await stateRedis.set(`socket:${userId}`, socketId); // link userId
      console.log(`registered: ${userId}`);
    },

    async startGameIfNeeded(gameId) {
      const key = `game:${gameId}:expires`;
      // try to set key only if it doesnt exist (to avoid potential race condition)
      const started = await stateRedis.set(key, '1', 'PX', GAME_DURATION_MS, 'NX');
      if (started) {
        const flipRatio = Math.random() * (0.7 - 0.3) + 0.3; // random between 0.3 and 0.7
        const flipped_duration = Math.floor(GAME_DURATION_MS * flipRatio);
        const flippedKey = `game:${gameId}:roleswap`
        const warningKey = `game:${gameId}:roleswap:warning`
        console.log("Flipped key being set");
        await stateRedis.set(flippedKey, '1', 'PX', flipped_duration, 'NX'); // set flip timer at the same time
        const warning_trigger = Math.max(0, flipped_duration - SECONDS_BEFORE_ROLE_SWAP_WARNING); // set the warning popup time
        console.log("Warning key being set")
        await stateRedis.set(warningKey, '1', 'PX', warning_trigger, 'NX');
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
      const ttl = await stateRedis.pttl(`game:${gameId}:expires`);
      return { ttl };
    },

    async getRoleSwapTime(gameId) {
      const ttl = await stateRedis.pttl(`game:${gameId}:roleswap`);
      return ttl > 0 ? ttl : null;
    },

    // Deletes all Redis timer keys for a game so expiration events stop firing
    // after the game ends early (e.g. via submitCode before the clock runs out).
    async cleanupGameTimers(gameId) {
      await stateRedis.del(`game:${gameId}:expires`);
      await stateRedis.del(`game:${gameId}:roleswap`);
      await stateRedis.del(`game:${gameId}:roleswap:warning`);
      await stateRedis.srem('activeGames', gameId);
      console.log(`Cleaned up Redis timers for game ${gameId}`);
    },

    async cleanupSocket(userId) {
      await stateRedis.del(`socket:${userId}`);
    },

    async getSocketId(userId) {
      return stateRedis.get(`socket:${userId}`);
    },

    async saveGameData(key, value) {
      return stateRedis.set(key, value);
    },

    async getGameData(key) {
      const data = await stateRedis.get(key);
      return data ? JSON.parse(data) : null;
    },

    async deleteGameData(key) {
      return stateRedis.del(key);
    },

    async removePlayersFromSockets(gameRoom) {
      for (const team of gameRoom.teams) {
        for (const player of team.players) {
          console.log('Looking up player:', player.userId);
          const socketId = await stateRedis.get(`socket:${player.userId}`);
          console.log('Found socketId:', socketId ?? 'null');

          if (!socketId) {
            console.log(`No socket mapping for user ${player.userId}; skipping room leave.`);
            continue;
          }

          try {
            // Cluster-safe: instruct any node to remove this socket from rooms
            await io.in(socketId).socketsLeave([gameRoom.id, team.id]);

            // Best-effort local logging if the socket is on this node
            const localSocket = io.sockets.sockets.get(socketId);
            if (localSocket) {
              console.log(`Socket: ${localSocket.id} left ${gameRoom.id} and ${team.id}`);
            } else {
              console.log(`Requested remote leave for socket ${socketId} from ${gameRoom.id} and ${team.id}`);
            }
          } catch (err) {
            console.error(`Error removing socket ${socketId} from rooms ${gameRoom.id}, ${team.id}:`, err);
          }
        }
      }
    }
  };
}

module.exports = { createGameService, GAME_DURATION_MS };