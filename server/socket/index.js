/* eslint-disable @typescript-eslint/no-require-imports */
const { Server } = require('socket.io');
const { registerSocketHandlers } = require('./handlers');
const { createGameService } = require('../game/gameService');

function initSocket(httpServer, redis) {
    const io = new Server(httpServer, {
        // transports/cors options could go here
    });

    // Attach Redis adapter for cluster support
    io.adapter(redis.adapter);

    // Create services using Redis state client
    const gameService = createGameService(redis.stateRedis);

    // Register per-connection handlers
    io.on('connection', (socket) => {
        registerSocketHandlers(io, socket, { gameService });
    });

    return io;
}

module.exports = { initSocket };
