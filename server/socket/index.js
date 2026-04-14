const { Server } = require('socket.io');
const { registerSocketHandlers } = require('./handlers');
const { createGameService } = require('../game/gameService');
const { createMatchmakingService } = require('../matchmaking/matchmakingService');
const { getPrisma } = require('../prisma');
const cookie = require('cookie');

function initSocket(httpServer, redis) {
    const io = new Server(httpServer, {
        // transports/cors options could go here
    });

    // Attach Redis adapter for cluster support
    io.adapter(redis.adapter);

    // Create services using Redis state client
    const gameService = createGameService(redis.stateRedis);
    const matchmakingService = createMatchmakingService(redis.stateRedis, io);

    io.use(async (socket, next) => {
        try {
            const cookieHeader = socket.handshake.headers.cookie;
            const cookies = cookie.parse(cookieHeader ?? '');
            const fullToken = decodeURIComponent(cookies['better-auth.session_token']);

            if (!fullToken) return next(new Error('Authentication error: No token provided'));

            const tokenParts = fullToken.split('.');
            const token = tokenParts[0];

            const session = await getPrisma().session.findUnique({
                where: { token },
                include: { user: true }
            });

            if (!session || session.expiresAt < new Date()) return next(new Error('Authentication error: Invalid token'));

            console.log(`Authenticated socket connection for user ${session.user.name} (ID: ${session.user.id})`);

            socket.userId = session.user.id;
            await gameService.registerSocketToUser(session.user.id, socket.id);
            next();
        } catch (e) {
            console.error('Socket authentication error:', e);
            next(new Error('Authentication error'));
        }
        
    });

    // Register per-connection handlers
    io.on('connection', (socket) => {
        registerSocketHandlers(io, socket, { gameService, matchmakingService });
    });

    return io;
}

module.exports = { initSocket };
