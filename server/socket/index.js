const { Server } = require('socket.io');
const { registerSocketHandlers } = require('./handlers');
const { createGameService } = require('../game/gameService');
const { createMatchmakingService } = require('../matchmaking/matchmakingService');
const { createInviteService } = require('../invite/inviteService');

function initSocket(httpServer, redis) {
    const io = new Server(httpServer, {
        // transports/cors options could go here
    });

    // Attach Redis adapter for cluster support
    io.adapter(redis.adapter);

    // Create services using Redis state client
    const gameService = createGameService(redis.stateRedis);
    const matchmakingService = createMatchmakingService(redis.stateRedis, io);
    const inviteService = createInviteService(redis.stateRedis);

    // Register per-connection handlers
    io.on('connection', (socket) => {
        registerSocketHandlers(io, socket, { gameService, matchmakingService, inviteService });
    });

    return io;
}

module.exports = { initSocket };
