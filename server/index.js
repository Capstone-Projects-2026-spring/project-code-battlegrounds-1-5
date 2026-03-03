/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http');
const next = require('next');
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
