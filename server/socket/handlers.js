const { GameType } = require("@prisma/client");

// Socket event handlers isolated here
// Expects io (Server), socket (Socket), and services to manage game state
function registerSocketHandlers(io, socket, services) {
  const { gameService } = services;

  console.log(`New connection: ${socket.id}`);

  socket.on('register', async ({userId }) => {
    socket.userId = userId;
    await gameService.registerSocketToUser(userId, socket.id); // needed before to emit from api to socket leaving in case useful later down the road
  });

  // 1. Handle joining a specific game room
  socket.on('joinGame', async ({ gameId, teamId, gameType }) => {
    await socket.join(teamId);
    await socket.join(gameId);

    // OK to bind to socket object because there are individual
    // sockets being created for every request. This is **not**
    // a global socket.
    socket.teamId = teamId;
    socket.gameId = gameId;

    // Determine how many people are currently in this specific room (cluster-aware)
    const socketsInRoom = await io.in(gameId).allSockets();
    console.log(`Room ${gameId} now has ${socketsInRoom.size} sockets`);
    const numPlayers = socketsInRoom ? socketsInRoom.size : 0;

    const gameExists = await gameService.isGameStarted(gameId);
    console.log(`Game Exists: ${gameExists}`);
    if (gameExists) {
      const time = await gameService.startGameIfNeeded(gameId); // gets the time
      socket.emit('gameStarted', {
        start: time.remaining,
        _duration: gameService.GAME_DURATION_MS
      });
    } else if ((numPlayers === 4 && gameType === GameType.FOURPLAYER) || (numPlayers === 2 && gameType === GameType.TWOPLAYER)) {
      console.log('gameType received:', gameType, 'expected:', GameType.TWOPLAYER, 'match:', gameType === GameType.TWOPLAYER);
      try {
        io.to(gameId).emit('gameStarting');
        setTimeout(async () => {
          const time = await gameService.startGameIfNeeded(gameId);
          console.log('game ttl:', time?.remaining, 'of', time?.duration);
          io.to(gameId).emit('gameStarted', { start: time?.remaining, _duration: gameService.GAME_DURATION_MS });
        }, 3000);
      } catch (e) {
        console.error('Failed to start game', e);
      }
    }

    // Send latest code state from Redis if present so the joiner syncs
    try {
      const latestCode = await gameService.getLatestCode(teamId);
      if (latestCode != null) {
        socket.emit('receiveCodeUpdate', latestCode);
      }
    } catch (e) {
      console.error('Error fetching code from Redis', e);
    }

    console.log(`Socket ${socket.id} joined room ${gameId} and team ${teamId}`);
  });

  // 2. Handle live code relay (Coder -> Server -> Tester)
  socket.on('codeChange', async (data) => {
    const { teamId, code } = data || {};
    if (!teamId) return;

    try {
      await gameService.saveLatestCode(teamId, code);
    } catch (e) {
      console.error('Error saving code to Redis', e);
    }

    // Broadcast the updated code to everyone else in the same room (except the sender)
    socket.to(teamId).emit('receiveCodeUpdate', code);
  });

  socket.on('sendChat', async (data) => {
    const { teamId, message } = data || {};
    if (!teamId || !message) return;

    try {
      await gameService.saveChatMessage(teamId, message);
    } catch (e) {
      console.error('Error saving chat message to Redis', e);
    }

    // Broadcast the chat message to everyone else in the same room (except the sender)
    socket.to(teamId).emit('receiveChat', message);
  });

  socket.on('requestChatSync', async ({ teamId }) => {
    try {
      const parsed = await gameService.getChatMessages(teamId);
      socket.emit('receiveChatHistory', parsed);
    } catch (e) {
      console.error('Error fetching chat history', e);
    }
  });

  socket.on('updateTestCases', async ({ teamId, testCases }) => {
    try {
      await gameService.saveTestCases(teamId, testCases);
    } catch (e) {
      console.error('Error saving test cases', e);
    }
  });

  socket.on('requestTestCaseSync', async ({ teamId }) => {
    try {
      const testCases = await gameService.getTestCases(teamId);
      if (testCases) socket.emit('receiveTestCaseSync', testCases);
    } catch (e) {
      console.error('Error fetching test cases', e);
    }
  });

  socket.on('submitCode', async (data) => {
    const { roomId, code, type } = data || {};
    if (!roomId) return;
    //TODO Store submission and evaluate results on the backend
    //Check gametype if Coop, store live code of team 1
    if (data.type === GameType.COOP) {
      // Store live code for team 1
      await prisma.GameResult.update({
        data: {
          team1Code: code
        },
      });
    }

    io.to(roomId).emit('gameEnded');
  });

  socket.on('requestTeamUpdate', async ({ gameId, teamId, playerCount }) => {
    if (!playerCount) return;
    io.emit('teamUpdated', { teamId, playerCount }); // TODO: fix - this emits to everyone, scope it to game room except users don't join game room until after TeamSelect, 
    // so need to figure out a way to emit to all users in the game room including those in team select but not in the game room yet thinking another id to join off of that can be left after teamselect is done
  });

  // 3. Handle graceful disconnection
  socket.on('disconnect', async () => {
    console.log(`Disconnected: ${socket.id}`);
    if (socket.gameId && socket.userId) {
      await gameService.cleanupGame(socket.gameId, socket.userId);
    }
  });
}

module.exports = { registerSocketHandlers };
