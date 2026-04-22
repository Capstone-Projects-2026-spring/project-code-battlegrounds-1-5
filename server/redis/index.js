const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

function initRedis() {
    const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
    const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

    const pubClient = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
    const subClient = pubClient.duplicate();

    const adapter = createAdapter(pubClient, subClient);

    // Reuse pubClient for app-level state store
    const stateRedis = pubClient;

    return { pubClient, subClient, adapter, stateRedis };
}

module.exports = { initRedis };
