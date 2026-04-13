const { GameType } = require("@prisma/client");
const { z } = require("zod");

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
  value: z.string().nullable(),
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
  code: z.string().max(10000)
});

const messageSchema = z.object({
  id: z.string(),
  text: z.string().max(1000),
  userName: z.string(),
  timestamp: z.number()
});

const chatMessageSchema = z.object({
  teamId: z.string(),
  message: messageSchema
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
  code: z.string().max(10000)
});

// ─── Social schemas ───────────────────────────────────────────────────────────

const partyInviteSchema = z.object({
  toUserId: z.string(),
});

const partyJoinByCodeSchema = z.object({
  code: z.string().min(1).max(10),
});

const friendRequestSchema = z.object({
  friendCode: z.string().min(1).max(20),
});

const friendRequestRespondSchema = z.object({
  requestId: z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────

function registerSocketHandlers(io, socket, services) {
  const { gameService, matchmakingService, inviteService } = services;

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
      await gameService.registerSocketToUser(userId, socket.id);
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

    socket.teamId = teamId;
    socket.gameId = gameId;

    let numPlayers = 0;

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
        const time = await gameService.startGameIfNeeded(gameId);
        socket.emit('gameStarted', {
          start: time.remaining,
          _duration: gameService.GAME_DURATION_MS
        });
      } catch (e) {
        console.error('Error starting game', e);
        socket.emit('error', { e, message: 'Failed to start game.' });
      }
    } else if ((numPlayers === 4 && gameType === GameType.FOURPLAYER) || (numPlayers === 2 && gameType === GameType.TWOPLAYER)) {
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

    socket.to(teamId).emit('receiveCodeUpdate', code);
  });

  socket.on('sendChat', async (data) => {
    const payload = validate(chatMessageSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for sendChat.' });
      return;
    }

    const { teamId, message } = payload;

    try {
      await gameService.saveChatMessage(teamId, message);
    } catch (e) {
      console.error('Error saving chat message to Redis', e);
      socket.emit('error', { e, message: 'Failed to send chat message.' });
    }

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
    const { roomId, code } = payload;

    if (!roomId) return;

    try {
      fetch("http://fake-backend.lol:6969/execute", {
        method: "POST",
        body: { roomId, code }
      });
    } catch (error) {
      console.error("Error POSTing to code executor:", error);
    } finally {
      io.to(roomId).emit('gameEnded');
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
    const { gameId, teamId, code, testCases, runIDs } = data;

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
    io.emit('teamUpdated', { teamId, playerCount });
  });

  socket.on('joinQueue', async ({ userId, gameType, difficulty, partyId }) => {
    const result = await matchmakingService.joinQueue(userId, gameType, difficulty, partyId ?? null);
    socket.emit('queueStatus', result);
  });

  socket.on('leaveQueue', async ({ gameType, difficulty }) => {
    if (!socket.userId) return;
    const result = await matchmakingService.leaveQueue(socket.userId, gameType, difficulty);
    socket.emit('queueStatus', result);
  });

  socket.on('updateQueueSelection', async ({ gameType, difficulty, partyMember }) => {
    if (!socket.userId) return;
    const partyMemberSocket = await gameService.getSocketId(partyMember.userId);
    io.to(partyMemberSocket).emit('receiveQueueSelection', { gameType, difficulty });
  });

  socket.on('partySearch', async ({ partyMember, state }) => {
    if (!socket.userId) return;
    if (!partyMember) return;
    const partyMemberSocket = await gameService.getSocketId(partyMember.userId);
    io.to(partyMemberSocket).emit('partySearchUpdate', { state });
  });

  // ─── Party invite handlers ────────────────────────────────────────────────

  socket.on('partyInvite', async (data) => {
    const payload = validate(partyInviteSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for partyInvite.' });
      return;
    }
    if (!socket.userId) return;

    const result = await inviteService.sendPartyInvite(socket.userId, payload.toUserId);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    // Notify the invitee so their pendingInvite state updates immediately
    const toSocketId = await gameService.getSocketId(payload.toUserId);
    if (toSocketId) {
      io.to(toSocketId).emit('partyInviteReceived', result.invite);
    }
  });

  socket.on('partyInviteAccept', async () => {
    if (!socket.userId) return;

    const result = await inviteService.acceptPartyInvite(socket.userId);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    // Tell the accepter their partyJoined so InvitesTab can clear pendingInvite
    socket.emit('partyJoined', result.partyOwner);

    // Tell the owner their guest slot is now filled
    const ownerSocketId = await gameService.getSocketId(result.partyOwner.userId);
    if (ownerSocketId) {
      io.to(ownerSocketId).emit('partyMemberJoined', result.member);
    }
  });

  socket.on('partyInviteDecline', async () => {
    if (!socket.userId) return;

    const result = await inviteService.declinePartyInvite(socket.userId);
    if (result.error) {
      socket.emit('error', { message: result.error });
    }
  });

  socket.on('partyKick', async () => {
    if (!socket.userId) return;

    const result = await inviteService.kickPartyMember(socket.userId);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    // Tell the kicked user their slot is cleared so their partyCode view resets
    const kickedSocketId = await gameService.getSocketId(result.kickedUserId);
    if (kickedSocketId) {
      io.to(kickedSocketId).emit('joinedPartyLeft');
    }
  });

  socket.on('partyJoinByCode', async (data) => {
    const payload = validate(partyJoinByCodeSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for partyJoinByCode.' });
      return;
    }
    if (!socket.userId) return;

    const result = await inviteService.joinPartyByCode(socket.userId, payload.code);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    // Tell the joiner they're in so PartySlots can update their own view
    socket.emit('partyJoined', result.partyOwner);

    // Tell the owner their guest slot is filled with the joiner's details
    const ownerSocketId = await gameService.getSocketId(result.partyOwner.userId);
    if (ownerSocketId) {
      io.to(ownerSocketId).emit('partyMemberJoined', result.member);
    }
  });

  socket.on('partyLeave', async () => {
    if (!socket.userId) return;

    const result = await inviteService.leaveParty(socket.userId);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    const ownerSocketId = await gameService.getSocketId(result.ownerId);
    if (ownerSocketId) {
      io.to(ownerSocketId).emit('partyMemberLeft');
    }
  });

  // ─── Friend request handlers ──────────────────────────────────────────────

  socket.on('friendRequest', async (data) => {
    const payload = validate(friendRequestSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for friendRequest.' });
      return;
    }
    if (!socket.userId) return;

    const result = await inviteService.sendFriendRequest(socket.userId, payload.friendCode);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    // Confirm to sender so their outgoing requests list updates
    socket.emit('friendRequestSent', result.request);

    // Notify the addressee so their InvitesTab updates immediately
    const toSocketId = await gameService.getSocketId(result.addresseeId);
    if (toSocketId) {
      io.to(toSocketId).emit('friendRequestReceived', { ...result.request, direction: 'incoming' });
    }
  });

  socket.on('friendRequestAccept', async (data) => {
    const payload = validate(friendRequestRespondSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for friendRequestAccept.' });
      return;
    }
    if (!socket.userId) return;

    const result = await inviteService.acceptFriendRequest(socket.userId, payload.requestId);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    // Update the accepter's friends list
    socket.emit('friendRequestAccepted', result.friend);

    // Update the original requester's friends list
    const requesterSocketId = await gameService.getSocketId(result.requesterId);
    if (requesterSocketId) {
      io.to(requesterSocketId).emit('friendRequestAccepted', result.requesterFriend);
    }
  });

  socket.on('friendRequestDecline', async (data) => {
    const payload = validate(friendRequestRespondSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid payload for friendRequestDecline.' });
      return;
    }
    if (!socket.userId) return;

    const result = await inviteService.declineFriendRequest(socket.userId, payload.requestId);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    // Notify the requester their outgoing request was declined
    const requesterSocketId = await gameService.getSocketId(result.requesterId);
    if (requesterSocketId) {
      io.to(requesterSocketId).emit('friendRequestDeclined', { requestId: payload.requestId });
    }
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────

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
    if (socket.userId) {
      await matchmakingService.leaveAllQueues(socket.userId);
    }
  });
}

function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error('Validation error for socket event', { errors: result.error });
    return false;
  }
  return result.data;
}

module.exports = { registerSocketHandlers };