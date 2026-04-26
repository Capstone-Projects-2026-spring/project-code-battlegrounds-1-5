import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Redis as RedisClient } from 'ioredis';

export interface RedisClients {
    pubClient: RedisClient;
    subClient: RedisClient;
    adapter: ReturnType<typeof createAdapter>;
    stateRedis: RedisClient;
}

export function initRedis(): RedisClients {
    const redisHost = process.env.REDIS_HOST ?? '127.0.0.1';
    const redisPort = Number(process.env.REDIS_PORT) || 6379;

    const pubClient = new Redis({ host: redisHost, port: redisPort });
    const subClient = pubClient.duplicate();

    const adapter = createAdapter(pubClient, subClient);

    // Reuse pubClient for app-level state store.
    const stateRedis = pubClient;

    return { pubClient, subClient, adapter, stateRedis };
}
