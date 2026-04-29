const { io: ioc } = require("socket.io-client");

const SERVER_URL = `http://localhost:${process.env.PORT || 3000}`;

function makeClient() {
  return ioc(SERVER_URL, {
    autoConnect: false,
    transports: ["websocket"],
  });
}

function connectClient(client) {
  return new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
    client.connect();
  });
}

function connectAll(...clients) {
  return Promise.all(clients.map(connectClient));
}

function disconnectAll(...clients) {
  clients.forEach((c) => c.disconnect());
}

function waitFor(emitter, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs
    );
    emitter.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Emits joinGame and waits for the async handler to settle before returning.
async function joinGame(client, gameId, teamId, gameType = "TWOPLAYER") {
  client.emit("joinGame", { gameId, teamId, gameType });
  await new Promise((r) => setTimeout(r, 150));
}

// Generates a unique id suffix so Redis keys never collide between test runs.
function uid() {
  return Date.now();
}

module.exports = { makeClient, connectClient, connectAll, disconnectAll, waitFor, joinGame, uid };