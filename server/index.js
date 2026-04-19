const { createServer } = require('http');
const next = require('next');
const { startExpirationListener } = require('./game/expirationListener');
require('dotenv').config();

// Local modules
const { initRedis } = require('./redis');
const { initSocket } = require('./socket');

// Configure environment
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number(process.env.PORT) || 3000;

// Initialize the Next.js app (page handling)
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Create HTTP server to serve Next.js
  const httpServer = createServer(handle);

  // Initialize Redis (pub/sub for adapter + app state)
  const redis = initRedis();

  // Initialize Socket.IO, wire adapter + handlers + game timer
  const io = initSocket(httpServer, redis);

  // set redis to notify us of events and start listening. note that in production, this line will stop the deploy as it will not return correctly. instead, this config needs to be set in memorystore config.
  if (process.env.NODE_ENV === "development") {
    console.log("In dev mode. Setting Redis NOTIFY_KEYSPACE_EVENTS to Ex.");
    await redis.pubClient.config('SET', 'notify-keyspace-events', 'Ex');
  } else if (process.env.NODE_ENV === "production") {
    console.log("In prod mode. Assume Memorystore is properly configured");
  }
  startExpirationListener(io, redis.pubClient);

  // Start listening
  httpServer.listen(port, () => {
    const { REDIS_HOST = '127.0.0.1', REDIS_PORT = 6379 } = process.env;
    console.log(
      `Code BattleGrounds Server Ready on http://${hostname}:${port} (Redis @ ${REDIS_HOST}:${REDIS_PORT})`
    );
  });
}).catch((err) => {
  console.error('Failed to prepare Next.js app', err);
  process.exit(1);
});
