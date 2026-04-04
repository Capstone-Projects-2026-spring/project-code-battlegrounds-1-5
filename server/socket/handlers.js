const { GameType } = require("@prisma/client");
const { z } = require("zod");
const { getPrisma } = require("../prisma");

const ParameterPrimitive = z.union([
  z.literal("string"),
  z.literal("number"),
  z.literal("array_string"),
  z.literal("array_number"),
  z.literal("array_array_string"),
  z.literal("array_array_number"),
  z.literal("boolean")
]);

const Parameter = z.object({
  name: z.string(),
  type: ParameterPrimitive,
  value: z.string().nullable(), // Will be coerced into the correct primitive based on type.
  isOutputParameter: z.optional(z.boolean().default(false))
});

const registerSchema = z.object({
  userId: z.string(),
});

const joinGameSchema = z.object({
  gameId: z.string(),
  teamId: z.string(),
  gameType: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER])
});

const codeChangeSchema = z.object({
  teamId: z.string(),
  code: z.string().max(10000) // Adjust max length as needed
});

const chatMessageSchema = z.object({
  teamId: z.string(),
  message: z.string().max(1000) // Adjust max length as needed
});

const testableCaseSchema = z.object({
  id: z.number(),
  functionInput: z.array(Parameter),
  expectedOutput: Parameter,
  computedOutput: z.string().nullable().optional(),
});

const updateTestCasesSchema = z.object({
  teamId: z.string(),
  testCases: z.array(testableCaseSchema)
});

const requestSyncSchema = z.object({
  teamId: z.string(),
});

const requestTeamUpdateSchema = z.object({
  teamId: z.string(),
  playerCount: z.number(),
});

const submitCodeSchema = z.object({
  roomId: z.string(),
  code: z.string().max(10000), // Adjust max length as needed
  type: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER]),
  team: z.enum(["team1", "team2"]).nullable().optional(),
});


// Socket event handlers isolated here
// Expects io (Server), socket (Socket), and services to manage game state
function registerSocketHandlers(io, socket, services) {
  const { gameService } = services;
  const prisma = getPrisma();

  console.log(`New connection: ${socket.id}`);

  socket.on('register', async (data) => {
    const payload = validate(registerSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for register.' });
      return;
    }

    const { userId } = payload;
    socket.userId = userId;
    try {
      await gameService.registerSocketToUser(userId, socket.id); // needed before to emit from api to socket leaving in case useful later down the road
    } catch (e) {
      console.error('Error registering socket to user in Redis', e);
      socket.emit('error', { e, message: 'Failed to register socket.' });
    }

  });
 
  socket.on('joinGame', async (data) => {
    const payload = validate(joinGameSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for joinGame.' });
      return;
    }

    const { gameId, teamId, gameType } = payload;
    try {
      await socket.join(teamId);
      await socket.join(gameId);
    } catch (e) {
      console.error('Error joining game room', e);
      socket.emit('error', { e, message: 'Failed to join game room.' });
    }

    // OK to bind to socket object because there are individual
    // sockets being created for every request. This is **not**
    // a global socket.
    socket.teamId = teamId;
    socket.gameId = gameId;

    let numPlayers = 0;

    // Determine how many people are currently in this specific room (cluster-aware)
    try {
      const socketsInRoom = await io.in(gameId).allSockets();
      console.log(`Room ${gameId} now has ${socketsInRoom.size} sockets`);
      numPlayers = socketsInRoom ? socketsInRoom.size : 0;
    } catch (e) {
      console.error('Error fetching sockets in room', e);
      socket.emit('error', { e, message: 'Failed to fetch room information.' });
    }

    let gameExists = false;

    try {
      gameExists = await gameService.isGameStarted(gameId);
      console.log(`Game Exists: ${gameExists}`);
    } catch (e) {
      console.error('Error checking if game exists', e);
      socket.emit('error', { e, message: 'Failed to check game status.' });
    }

    if (gameExists) {
      try {
        const time = await gameService.startGameIfNeeded(gameId); // gets the time
        socket.emit('gameStarted', {
          start: time.remaining,
          _duration: gameService.GAME_DURATION_MS
        });
      } catch (e) {
        console.error('Error starting game', e);
        socket.emit('error', { e, message: 'Failed to start game.' });
      }
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
        socket.emit('error', { e, message: 'Failed to start game.' });
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
      socket.emit('error', { e, message: 'Failed to fetch latest code.' });
    }

    console.log(`Socket ${socket.id} joined room ${gameId} and team ${teamId}`);
  });

  socket.on('codeChange', async (data) => {
    const payload = validate(codeChangeSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for codeChange.' });
      return;
    }

    const { teamId, code } = payload;
    try {
      await gameService.saveLatestCode(teamId, code);
    } catch (e) {
      console.error('Error saving code to Redis', e);
      socket.emit('error', { e, message: 'Failed to save code update.' });
    }

    // Broadcast the updated code to everyone else in the same room (except the sender)
    socket.to(teamId).emit('receiveCodeUpdate', code);
  });

  socket.on('sendChat', async (data) => {
    const payload = validate(chatMessageSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for sendChat.' });
      return;
    }

    try {
      await gameService.saveChatMessage(teamId, message);
    } catch (e) {
      console.error('Error saving chat message to Redis', e);
      socket.emit('error', { e, message: 'Failed to send chat message.' });
    }

    // Broadcast the chat message to everyone else in the same room (except the sender)
    socket.to(teamId).emit('receiveChat', message);
  });

  socket.on('requestChatSync', async (data) => {
    const payload = validate(requestSyncSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for requestChatSync.' });
      return;
    }
    const { teamId } = payload;

    try {
      const parsed = await gameService.getChatMessages(teamId);
      socket.emit('receiveChatHistory', parsed);
    } catch (e) {
      console.error('Error fetching chat history', e);
      socket.emit('error', { e, message: 'Failed to fetch chat history.' });
    }
  });

  socket.on('updateTestCases', async (data) => {
    const payload = validate(updateTestCasesSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for updateTestCases.' });
      return;
    }
    const { teamId, testCases } = payload;

    try {
      await gameService.saveTestCases(teamId, testCases);
    } catch (e) {
      console.error('Error saving test cases', e);
      socket.emit('error', { e, message: 'Failed to save test cases.' });
    }
  });

  socket.on('requestTestCaseSync', async (data) => {
    const payload = validate(requestSyncSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for requestTestCaseSync.' });
      return;
    }
    const { teamId } = payload;

    try {
      const testCases = await gameService.getTestCases(teamId);
      if (testCases) socket.emit('receiveTestCaseSync', testCases);
    } catch (e) {
      console.error('Error fetching test cases', e);
      socket.emit('error', { e, message: 'Failed to fetch test cases.' });
    }
  });

  socket.on('submitCode', async (data) => {
    const payload = validate(submitCodeSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for submitCode.' });
      return;
    }
    const { roomId, code, type, team } = payload;

    if (!roomId) return;

    console.log('submitCode received for roomId:', roomId, 'with code length:', code.length, 'and type:', type);

    if(type === GameType.TWOPLAYER) {
      console.log('verify its a twoplayer game');
      await prisma.gameResult.update({
        where: { gameRoomId: roomId },
        data: {
          gameRoomId: roomId,
          team1Code: code
        }
      });
      console.log('code submitted for two-player game');

      try {
        // Post results to the code executor
        fetch("http://fake-backend.lol:6969/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            code
          })
        });
      } catch (error) {
        console.error("Error POSTing to code executor:", error);
      } finally {
        io.to(roomId).emit('gameEnded');
      }
    }
    else if (type === GameType.FOURPLAYER) {
      console.log('verify its a fourplayer game');
      if (!team) {
        socket.emit('error', { message: 'Missing team for four-player submitCode.' });
        return;
      }

      // Track submissions in Redis
      const submissionKey = `game:${roomId}:submissions`;
      const existingSubmissions = await gameService.getGameData(submissionKey);

      if (existingSubmissions && existingSubmissions[team]) {
        console.log(`Team ${team} already submitted, ignoring duplicate submission`);
        return;
      }

      // Store this team's code
      await prisma.gameResult.update({
        where: { gameRoomId: roomId },
        data: {
          gameRoomId: roomId,
          ...(team === "team1" ? { team1Code: code } : { team2Code: code })
        }
      });
      console.log(`code submitted for four-player game by ${team}`);

      // Track submission
      const updatedSubmissions = {
        ...(existingSubmissions || {}),
        [team]: true
      };
      await gameService.saveGameData(submissionKey, JSON.stringify(updatedSubmissions));

      // Check if both teams have submitted
      if (Object.keys(updatedSubmissions).length === 2) {
        // Both teams submitted - end game
        console.log('Both teams submitted, ending game');
        try {
          fetch("http://fake-backend.lol:6969/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId,
              code
            })
          });
        } catch (error) {
          console.error("Error POSTing to code executor:", error);
        } finally {
          io.to(roomId).emit('gameEnded');
          await gameService.deleteGameData(submissionKey);
        }
      } else {
        // First team submitted - notify waiting
        console.log('First team submitted, waiting for other team');
        io.to(roomId).emit('waitingForOtherTeam');
      }
    }

  });

  /**
   * data: object
   * data.gameId: string,
   * data.teamId: string,
   * data.code: string,
   * data.testCases: Array<TestableCase>
   * data.runIDs: Array<number> test case IDs to run
   * 
   * @see GameTestCasesContext#TestableCase
   */
  socket.on("submitTestCases", async (data) => {
    const {
      gameId,
      teamId,
      code,
      testCases,
      runIDs
    } = data;

    const res = await fetch("http://fake-backend.lol:6969/execute-tests", {
      method: "POST",
      body: {
        gameId,
        teamId,
        code,
        testCases: JSON.stringify(testCases),
        runIDs: JSON.stringify(runIDs)
      },
    });
    const json = await res.json();

    // json.testCases should realistically only modify a single property
    // on the existing testCases object: `computedOutput`. Syncing this
    // back to the frontend is handled over there :)
    socket.emit("receiveTestCaseSync", json.testCases);
  });

  socket.on('requestTeamUpdate', async (data) => {
    const payload = validate(requestTeamUpdateSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for requestTeamUpdate.' });
      return;
    }
    const { teamId, playerCount } = payload;

    if (!playerCount) return;
    io.emit('teamUpdated', { teamId, playerCount }); // TODO: fix - this emits to everyone, scope it to game room except users don't join game room until after TeamSelect, 
    // so need to figure out a way to emit to all users in the game room including those in team select but not in the game room yet thinking another id to join off of that can be left after teamselect is done
  });

  // 3. Handle graceful disconnection need to do more to this so will just leave it to this right now
  socket.on('disconnect', async () => {
    if (socket.gameId && socket.userId) {
      try {
        await gameService.cleanupGame(socket.gameId, socket.userId);
        console.log(`Disconnected: ${socket.id}`);
      } catch (e) {
        console.error('Error during cleanup on disconnect', e);
        socket.emit('error', { e, message: 'Failed to cleanup on disconnect.' });
      }
    }

  });
}

function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error('Validation error for socket event', { errors: result.error.errors });
    return false;
  }
  return result.data;
}

module.exports = { registerSocketHandlers };
