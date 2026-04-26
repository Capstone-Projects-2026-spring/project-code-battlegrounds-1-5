import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import dotenv from 'dotenv';
import next from 'next';
import { startExpirationListener } from './game/expirationListener';
import { initRedis } from './redis';
import { initSocket } from './socket';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = Number(process.env.PORT) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

void (async (): Promise<void> => {
  await app.prepare();

  const httpServer = createServer(handle);

  httpServer.on('upgrade', (req, socket: Socket) => {
    console.log('[WS] HTTP upgrade attempt:', {
      url: req.url,
      origin: req.headers?.origin,
      host: req.headers?.host,
      upgrade: req.headers?.upgrade,
    });

    socket.on('error', (error) => {
      console.error('[WS] raw socket error during upgrade:', error);
    });
  });

  httpServer.on('error', (error) => {
    console.error('[WS] httpServer error:', error);
  });

  const redis = initRedis();
  const io = initSocket(httpServer, redis);

  io.engine.on('connection_error', (error) => {
    console.error('[WS] connection_error', {
      code: error.code,
      message: error.message,
      context: error.context,
      url: error.req?.url,
      origin: error.req?.headers?.origin,
    });
  });

  io.engine.on('headers', (_headers, req) => {
    console.log('[WS] upgrade headers from origin:', req.headers?.origin, 'url:', req.url);
  });

  io.on('connection', (socket) => {
    console.log('[WS] socket connected:', socket.id, '| transport:', socket.conn.transport.name);

    socket.conn.on('upgrade', (transport) => {
      console.log('[WS] transport upgraded to:', transport.name, 'for socket:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] socket disconnected:', socket.id, '| reason:', reason);
    });

    socket.on('error', (error) => {
      console.error('[WS] socket error:', socket.id, error);
    });
  });

  // In production, this should be configured in Memorystore instead.
  if (process.env.NODE_ENV === 'development') {
    console.log('In dev mode. Setting Redis NOTIFY_KEYSPACE_EVENTS to Ex.');
    await redis.pubClient.config('SET', 'notify-keyspace-events', 'Ex');
  } else if (process.env.NODE_ENV === 'production') {
    console.log('In prod mode. Assume Memorystore is properly configured');
  }

  startExpirationListener(io, redis.pubClient);

  httpServer.listen(port, () => {
    const { REDIS_HOST = '127.0.0.1', REDIS_PORT = '6379' } = process.env;
    console.log(
      `Code BattleGrounds Server Ready on http://${hostname}:${port} (Redis @ ${REDIS_HOST}:${REDIS_PORT})`
    );
  });
})().catch((error: unknown) => {
  console.error('Failed to prepare Next.js app', error);
  process.exit(1);
});
