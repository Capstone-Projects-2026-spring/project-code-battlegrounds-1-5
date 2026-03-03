/* eslint-disable @typescript-eslint/no-require-imports */
// Socket event handlers isolated here
// Expects io (Server), socket (Socket), and services to manage game state

function registerSocketHandlers(io, socket, services) {
  const { gameService } = services;

  console.log(`New connection: ${socket.id}`);

  // 1. Handle joining a specific game room
  socket.on('joinGame', async (gameId) => {
    await socket.join(gameId);

    // Determine how many people are currently in this specific room (cluster-aware)
    const socketsInRoom = await io.in(gameId).allSockets();
    const numPlayers = socketsInRoom ? socketsInRoom.size : 0;

    // Role Assignment Logic
    let role = 'spectator';
    if (numPlayers === 1) {
      role = 'coder'; // First person in
      socket.emit('waitingForTester'); // Notify the coder to wait for a tester
    } else if (numPlayers === 2) {
      role = 'tester'; // Second person in

      const startedAt = await gameService.ensureGameStarted(gameId);

      io.to(gameId).emit('gameStarted', { start: startedAt, durat: gameService.GAME_DURATION_MS });
    }

    // Emit the assigned role back ONLY to the person who just joined
    socket.emit('roleAssigned', role);
    // TODO: update player/role assignment in postgres here. See CODEBAT-14 and CODEBAT-56

    // Send latest code state from Redis if present so the joiner syncs
    try {
      const latestCode = await gameService.getLatestCode(gameId);
      if (latestCode != null) {
        socket.emit('receiveCodeUpdate', latestCode);
      }
    } catch (e) {
      console.error('Error fetching code from Redis', e);
    }

    console.log(`Socket ${socket.id} joined room ${gameId} as ${role}`);
  });

  // 2. Handle live code relay (Coder -> Server -> Tester)
  socket.on('codeChange', async (data) => {
    const { roomId, code } = data || {};
    if (!roomId) return;

    try {
      await gameService.saveLatestCode(roomId, code);
    } catch (e) {
      console.error('Error saving code to Redis', e);
    }

    // Broadcast the updated code to everyone else in the same room (except the sender)
    socket.to(roomId).emit('receiveCodeUpdate', code);
  });

  socket.on('sendChat', async (data) => {
    const { roomId, message } = data || {};
    if (!roomId || !message) return;

    // Broadcast the chat message to everyone else in the same room (except the sender)
    socket.to(roomId).emit('receiveChat', message);
  });

  // 3. Handle graceful disconnection
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
}

module.exports = { registerSocketHandlers };
